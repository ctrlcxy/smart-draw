'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useMemo, useRef } from 'react';
import '@excalidraw/excalidraw/index.css';
import { getSceneVersion } from '@excalidraw/excalidraw';

// Dynamically import Excalidraw with no SSR
const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false }
);

// Dynamically import convertToExcalidrawElements
const getConvertFunction = async () => {
  const excalidrawModule = await import('@excalidraw/excalidraw');
  return excalidrawModule.convertToExcalidrawElements;
};

const debounce = (fn, delay) => {
  let timerId;
  return (...args) => {
    if (timerId) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
};

export default function ExcalidrawCanvas({ elements, onChange, showNotification }) {
  const [convertToExcalidrawElements, setConvertFunction] = useState(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const lastSceneVersionRef = useRef(0);
  const skipProgrammaticChangeRef = useRef(false);
  const debouncedOnChange = useRef(null);

  // Load convert function on mount
  useEffect(() => {
    getConvertFunction().then(fn => {
      setConvertFunction(() => fn);
    });
  }, []);

  // Convert elements to Excalidraw format
  const { convertedElements, conversionError } = useMemo(() => {
    if (!elements || elements.length === 0 || !convertToExcalidrawElements) {
      return { convertedElements: [], conversionError: null };
    }

    try {
      return {
        convertedElements: convertToExcalidrawElements(elements),
        conversionError: null,
      };
    } catch (error) {
      console.error('Failed to convert elements:', error);
      return { convertedElements: [], conversionError: error };
    }
  }, [elements, convertToExcalidrawElements]);

  // Notify user when conversion fails (side-effect after render)
  useEffect(() => {
    if (conversionError && showNotification) {
      showNotification({
        title: '画布解析失败',
        message: '生成的绘图代码解析时出现问题，请在聊天消息中点击「重新生成」后重试。',
        type: 'error',
      });
    }
  }, [conversionError, showNotification]);

  // Auto zoom to fit content when API is ready and elements change
  useEffect(() => {
    if (excalidrawAPI && convertedElements.length > 0) {
      // Small delay to ensure elements are rendered
      setTimeout(() => {
        excalidrawAPI.scrollToContent(convertedElements, {
          fitToContent: true,
          animate: true,
          duration: 300,
        });
      }, 100);
    }
  }, [excalidrawAPI, convertedElements]);

  // Whenever elements are injected from code, remember the version and skip the next change event
  useEffect(() => {
    const injectedVersion = getSceneVersion(convertedElements || []);
    lastSceneVersionRef.current = injectedVersion;
    skipProgrammaticChangeRef.current = true;
  }, [convertedElements]);

  // Generate unique key when elements change to force remount
  const canvasKey = useMemo(() => {
    if (convertedElements.length === 0) return 'empty';
    // Create a hash from elements to detect changes
    return JSON.stringify(convertedElements.map(el => el.id)).slice(0, 50);
  }, [convertedElements]);

  // Handle changes from Excalidraw - delegate to parent
  const handleChange = (nextElements, appState, files) => {
    if (!onChange || !nextElements) {
      return;
    }

    const currentVersion = getSceneVersion(nextElements);

    if (skipProgrammaticChangeRef.current) {
      skipProgrammaticChangeRef.current = false;
      lastSceneVersionRef.current = currentVersion;
      return;
    }

    if (currentVersion === lastSceneVersionRef.current) {
      return;
    }

    lastSceneVersionRef.current = currentVersion;

    if (!debouncedOnChange.current) {
      debouncedOnChange.current = debounce((elementsArg, appStateArg, filesArg) => {
        if (onChange) {
          onChange(elementsArg, appStateArg, filesArg);
        }
      }, 500);
    }

    debouncedOnChange.current(nextElements, appState, files);
  };

  return (
    <div className="w-full h-[calc(100vh-64px)]">
      <Excalidraw
        key={canvasKey}
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        onChange={handleChange}
        initialData={{
          elements: convertedElements,
          appState: {
            viewBackgroundColor: '#ffffff',
            currentItemFontFamily: 1,
          },
          scrollToContent: true,
        }}
      />
    </div>
  );
}
