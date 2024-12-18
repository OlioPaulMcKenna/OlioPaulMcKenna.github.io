// src/components/Calendar.tsx

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CalendarWindow } from './CalendarWindow';
import { LoadingScreen } from './LoadingScreen';
import { BACKGROUND_IMAGE_URL } from '../constants';
import { canOpenDoor } from '../utils';
import { useCalendarWindows } from '../hooks/useCalendarWindows';
import { getViewportSize } from '../utils/windowUtils';
import { useBackgroundMusicVolume } from '../hooks/useBackgroundMusicVolume';
import { SnowEffect } from './SnowEffect';

export const Calendar = () => {
  const [allImagesLoaded, setAllImagesLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const { day } = useParams<{ day?: string }>();
  const navigate = useNavigate();
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Add state for zoom transform
  const [zoomTransform, setZoomTransform] = useState({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  const { adjustVolume } = useBackgroundMusicVolume();

  // Get initial container size
  const [containerSize, setContainerSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Update container size once mounted
  useEffect(() => {
    const size = getViewportSize();
    setContainerSize(size);
  }, []);

  // Use the custom hook to manage calendar windows
  const [windows, setWindows] = useCalendarWindows(containerSize);

  // Handle window click events
  const handleWindowClick = useCallback(
    (clickedDay: number) => {
      if (!activeDay) {
        // Zoom in to the selected day
        setIsZooming(true);
        setActiveDay(clickedDay.toString());
        navigate(`/day/${clickedDay}`, { replace: true });
      } else {
        // Check if the door can be opened
        if (!canOpenDoor(clickedDay)) {
          return;
        }
        // Toggle the window's open state
        setWindows((prevWindows) => {
          const newWindows = [...prevWindows];
          const windowIndex = newWindows.findIndex(
            (w) => w.day === clickedDay
          );
          if (windowIndex !== -1) {
            newWindows[windowIndex] = {
              ...newWindows[windowIndex],
              isOpen: !newWindows[windowIndex].isOpen,
            };
          }
          return newWindows;
        });
      }
    },
    [activeDay, navigate, setWindows, containerSize]
  );

  // Handle background click to zoom out
  const handleBackgroundClick = useCallback(() => {
    if (activeDay) {
      setIsZooming(true);
      setActiveDay(null);
      navigate('/', { replace: true });
    }
  }, [activeDay, navigate]);

  // Handle window close events
  const handleWindowClose = useCallback(
    (clickedDay: number) => {
      // Close the window
      setWindows((prevWindows) => {
        const newWindows = [...prevWindows];
        const windowIndex = newWindows.findIndex(
          (w) => w.day === clickedDay
        );
        if (windowIndex !== -1) {
          newWindows[windowIndex] = {
            ...newWindows[windowIndex],
            isOpen: false,
          };
        }
        // Save updated windows to localStorage

        return newWindows;
      });

      // Reset zoom state and navigate back
      setIsZooming(true);
      setActiveDay(null);
      navigate('/', { replace: true });
    },
    [navigate, setWindows, containerSize]
  );

  // Preload images and set loading state
  useEffect(() => {
    const preloadImage = async (url: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const img = new Image();

        const handleLoad = () => {
          img.removeEventListener('load', handleLoad);
          img.removeEventListener('error', handleError);
          resolve();
        };

        const handleError = () => {
          img.removeEventListener('load', handleLoad);
          img.removeEventListener('error', handleError);
          console.warn(`Failed to load image: ${url}`);
          reject(new Error(`Failed to load image: ${url}`));
        };

        img.addEventListener('load', handleLoad);
        img.addEventListener('error', handleError);
        img.src = url;
      });
    };

    const loadAllImages = async () => {
      try {
        setIsLoading(true);
        setAllImagesLoaded(false);
        setLoadingProgress(0);

        // List of images to preload
        const imageUrls = [
          BACKGROUND_IMAGE_URL,
          '/content/day8-quote.jpg',
          '/content/day9-quote.jpg',
          '/content/day10-quote.jpg',
          ...Array.from(
            { length: 12 },
            (_, i) => `/content/day${i + 1}.jpg`
          ),
          ...Array.from(
            { length: 12 },
            (_, i) => `/content/day${i + 1}-thumb.jpeg`
          ),
        ];

        // Load images concurrently and track progress
        let loaded = 0;
        await Promise.all(
          imageUrls.map((url) =>
            preloadImage(url)
              .then(() => {
                loaded++;
                setLoadingProgress((loaded / imageUrls.length) * 100);
              })
              .catch((error) => {
                console.error('Failed to load image:', error);
                loaded++;
                setLoadingProgress((loaded / imageUrls.length) * 100);
              })
          )
        );

        // Images loaded
        setAllImagesLoaded(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading images:', error);
        setAllImagesLoaded(true);
        setIsLoading(false);
      }
    };

    loadAllImages();
  }, []);

  // Handle initial load and URL changes
  useEffect(() => {
    if (!allImagesLoaded || windows.length === 0 || !isInitialLoad)
      return;

    // Start with zoomed-out view
    setZoomTransform({ scale: 1, translateX: 0, translateY: 0 });

    if (day) {
      // Zoom into the day after a delay
      const timer = setTimeout(() => {
        setIsZooming(true);
        setActiveDay(day);
      }, 1000);
      return () => clearTimeout(timer);
    }
    setIsInitialLoad(false);
  }, [allImagesLoaded, windows.length, day, isInitialLoad]);

  // Handle URL changes after initial load
  useEffect(() => {
    if (isInitialLoad) return;

    if (!day && activeDay) {
      // Zoom out when navigating back to home
      setIsZooming(true);
      setActiveDay(null);
    } else if (day && day !== activeDay) {
      // Zoom into the new day
      setIsZooming(true);
      setActiveDay(day);
    }
    setIsInitialLoad(false);
  }, [day, activeDay, isInitialLoad, containerSize]);

  // Handle transition end
  const handleTransitionEnd = useCallback(() => {
    setIsZooming(false);
  }, []);

  // Handle resize events
  useEffect(() => {
    const handleResize = () => {
      // Add a small delay to ensure the container has been resized
      setTimeout(() => {
        setContainerSize(getViewportSize());
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('zoom', handleResize); // Handle zoom events if supported

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('zoom', handleResize);
    };
  }, []);

  // Update container size on window resize
  useEffect(() => {
    const handleResize = () => {
      const size = getViewportSize();
      setContainerSize(size);
    };

    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener(
          'resize',
          handleResize
        );
      }
    };
  }, []);

  // Handle zoom animations
  useEffect(() => {
    if (!windows.length) return;

    if (activeDay) {
      const dayNumber = parseInt(activeDay);
      const selectedWindow = windows.find((w) => w.day === dayNumber);
      if (selectedWindow) {
        // Calculate zoom transform
        const windowX = selectedWindow.x;
        const windowY = selectedWindow.y;
        const windowWidth = parseFloat(selectedWindow.width);
        const windowHeight = parseFloat(selectedWindow.height);

        // Use container size consistently
        const viewportWidth = containerSize.width;
        const viewportHeight = containerSize.height;

        const targetWidth = viewportWidth * 0.8;
        const targetHeight = viewportHeight * 0.8;
        const scaleX = targetWidth / windowWidth;
        const scaleY = targetHeight / windowHeight;
        const scale = Math.min(scaleX, scaleY);

        const containerCenterX = viewportWidth / 2;
        const containerCenterY = viewportHeight / 2;
        const windowCenterX = windowX + windowWidth / 2;
        const windowCenterY = windowY + windowHeight / 2;

        const offsetX = containerCenterX - windowCenterX;
        const offsetY = containerCenterY - windowCenterY;

        const translateX = offsetX * scale;
        const translateY = offsetY * scale;

        setZoomTransform({ scale, translateX, translateY });
      }
    } else {
      // Reset zoom
      setZoomTransform({ scale: 1, translateX: 0, translateY: 0 });
    }
  }, [activeDay, windows, containerSize]);

  // Handle wheel events to zoom out
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (activeDay) {
        e.preventDefault();
        setIsZooming(true);
        setActiveDay(null);
        adjustVolume(0.2);
        navigate('/', { replace: true });
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [activeDay, navigate]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeDay) return;

      const currentDay = parseInt(activeDay);

      // Handle ESC, Space, Enter, Backspace
      if (
        e.key === 'Escape' ||
        e.key === ' ' ||
        e.key === 'Enter' ||
        e.key === 'Backspace'
      ) {
        e.preventDefault();
        setIsZooming(true);
        setActiveDay(null);
        adjustVolume(0.22);
        navigate('/', { replace: true });
        return;
      }

      // Handle arrow keys
      if (e.key === 'ArrowLeft' && currentDay > 1) {
        e.preventDefault();
        const prevDay = currentDay - 1;
        setIsZooming(true);
        setActiveDay(null);
        adjustVolume(0.21);
        navigate('/', { replace: true });
        setTimeout(() => {
          setIsZooming(true);
          setActiveDay(prevDay.toString());

          navigate(`/day/${prevDay}`, { replace: true });
        }, 1000);
        return;
      }

      if (e.key === 'ArrowRight' && currentDay < 12) {
        e.preventDefault();
        const nextDay = currentDay + 1;
        setIsZooming(true);
        setActiveDay(null);
        navigate('/', { replace: true });
        setTimeout(() => {
          setIsZooming(true);
          setActiveDay(nextDay.toString());
          adjustVolume(0.23);
          navigate(`/day/${nextDay}`, { replace: true });
        }, 1000);
        return;
      }

      // Handle number keys 1-9
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= 12) {
        e.preventDefault();
        if (num === currentDay) return;
        setIsZooming(true);
        setActiveDay(null);
        navigate('/', { replace: true });
        setTimeout(() => {
          setIsZooming(true);
          setActiveDay(num.toString());
          adjustVolume(0.24);
          navigate(`/day/${num}`, { replace: true });
        }, 1000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDay, navigate, adjustVolume]);

  // Prevent browser zoom (both pinch and keyboard)
  useEffect(() => {
    const preventZoom = (e: WheelEvent | KeyboardEvent) => {
      // Prevent Ctrl/Cmd + wheel zoom
      if (e instanceof WheelEvent && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
      }

      // Prevent Ctrl/Cmd + +/- zoom
      if (e instanceof KeyboardEvent && (e.ctrlKey || e.metaKey)) {
        if (
          e.key === '=' ||
          e.key === '-' ||
          e.key === '+' ||
          e.key === '_'
        ) {
          e.preventDefault();
        }
      }
    };

    const preventPinchZoom = (e: TouchEvent) => {
      // If there are 2 or more touch points, it's a pinch gesture
      if (e.touches.length > 1) {
        e.preventDefault();

        // Check if any touch started on a door
        const touchOnDoor = Array.from(e.touches).some((touch) => {
          const element = touch.target as HTMLElement;
          return element.closest('.calendar-window') !== null;
        });

        // If touch started on a door and we're not zoomed in, zoom into that door
        if (touchOnDoor && !activeDay) {
          const doorElement = (
            e.touches[0].target as HTMLElement
          ).closest('.calendar-window');
          if (doorElement) {
            const day = doorElement.getAttribute('data-day');
            if (day) {
              setIsZooming(true);
              setActiveDay(day);
              navigate(`/${day}`, { replace: true });
            }
          }
        }
        // If we're already zoomed in, zoom out
        else if (activeDay) {
          setIsZooming(true);
          setActiveDay(null);
          navigate('/', { replace: true });
        }
      }
    };

    // Add the event listeners with passive: false to allow preventDefault
    window.addEventListener('wheel', preventZoom, { passive: false });
    window.addEventListener('keydown', preventZoom, {
      passive: false,
    });
    document.addEventListener('touchstart', preventPinchZoom, {
      passive: false,
    });
    document.addEventListener('touchmove', preventPinchZoom, {
      passive: false,
    });

    return () => {
      window.removeEventListener('wheel', preventZoom);
      window.removeEventListener('keydown', preventZoom);
      document.removeEventListener('touchstart', preventPinchZoom);
      document.removeEventListener('touchmove', preventPinchZoom);
    };
  }, [activeDay, navigate]);

  return (
    <div className="relative w-dvw h-dvh overflow-hidden ">
      {isLoading ? (
        <LoadingScreen progress={loadingProgress} />
      ) : (
        <div
          onClick={handleBackgroundClick}
          onTransitionEnd={handleTransitionEnd}
          className={`relative w-full h-full transition-all duration-1000 ${
            isZooming ? 'ease-in-out' : ''
          } pointer-events-none`}
          style={{
            willChange: 'transform',
            transform: `scale(${zoomTransform.scale}) translate(${
              zoomTransform.translateX / zoomTransform.scale
            }px, ${
              zoomTransform.translateY / zoomTransform.scale
            }px)`,
            transformOrigin: 'center center',
          }}
        >
          <SnowEffect />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("${BACKGROUND_IMAGE_URL}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'brightness(0.95)',
              pointerEvents: 'auto',
              cursor: activeDay ? 'pointer' : 'default',
            }}
          />
          {allImagesLoaded && (
            <div className="relative w-full h-full">
              {windows.map((window) => (
                <div
                  key={window.day}
                  className={`transition-transform duration-1000 ${
                    isZooming ? 'ease-in-out' : ''
                  }`}
                  style={{
                    willChange: 'transform',
                    transform:
                      activeDay && parseInt(activeDay) === window.day
                        ? 'translateZ(20px)'
                        : 'none',
                  }}
                >
                  <CalendarWindow
                    window={window}
                    onWindowClick={handleWindowClick}
                    onWindowClose={handleWindowClose}
                    day={day || null}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
