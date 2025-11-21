'use client';

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, memo } from 'react';
import { getEmbedUrl } from './drawio/utils/getEmbedUrl';
import { handleEvent } from './drawio/utils/handleEvent';
import { useActions } from './drawio/hooks/useActions';

const DrawioCanvas = forwardRef(function DrawioCanvas(
  {
    xml,
    onSave,
    onAutosave,
    onError,
    onLoad,
    onClose,
    onExport,
    autosave = false,
    baseUrl,
    urlParameters,
    configuration,
    exportFormat = 'xml'
  },
  ref
) {
  const iframeRef = useRef(null);
  const action = useActions(iframeRef);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Generate Draw.io embed URL
  const iframeUrl = getEmbedUrl(baseUrl, urlParameters, !!configuration);

  // Expose actions to parent component via ref
  useImperativeHandle(
    ref,
    () => ({
      ...action,
      exportDiagram: action.exportDiagram,
      mergeDiagram: (xmlData) => action.merge({ xml: xmlData }),
      getXml: action.getXml
    }),
    [action.exportDiagram, action.merge, action.getXml]
  );

  // Handle messages from Draw.io iframe
  const messageHandler = useCallback((evt) => {
    handleEvent(
      evt,
      {
        init: () => {
          setIsInitialized(true);
          setIsLoading(false);
        },
        load: (data) => {
          console.log('Diagram loaded:', data);
          if (onLoad) {
            onLoad(data);
          }
        },
        configure: () => {
          if (configuration) {
            action.configure({ config: configuration });
          }
        },
        autosave: (data) => {
          // Prefer XML provided by autosave for engine/state updates
          if (onAutosave && data.xml) {
            onAutosave(data.xml);
          }

          if (onSave && data.xml) {
            onSave(data.xml);
          }
        },
        save: (data) => {
          // Trigger export instead of directly saving
          if (onSave && data.xml) {
            onSave(data.xml);
          }
        },
        exit: (data) => {
          console.log('Exit:', data.modified);
          if (onClose) {
            onClose(data);
          }
        },
        export: (data) => {
          // Handle the actual save after export completes
          if (onSave && data.data) {
            onSave(data.data);
          }

          if (onExport) {
            onExport(data);
          }

          // Handle exit after save if requested
          if (data.message && data.message.exit && onClose) {
            onClose({
              event: 'exit',
              modified: true,
              parentEvent: data.message.parentEvent || 'export'
            });
          }
        },
        error: (data) => {
          const errorMsg = data.message || 'Unknown error occurred';
          setError(errorMsg);
          if (onError) {
            onError(errorMsg);
          }
        }
      },
      baseUrl
    );
  }, [action.configure, action.exportDiagram, onSave, onLoad, onClose, onExport, onError, baseUrl, configuration, exportFormat]);

  // Set up message listener
  useEffect(() => {
    window.addEventListener('message', messageHandler);
    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, [messageHandler]);

  // Load diagram only when initialized and XML changes (avoid reloads on unrelated re-renders)
  const loadFn = action.load;
  useEffect(() => {
    if (!isInitialized) return;
    const loadObject = {
      xml: xml || '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>',
      autosave: autosave
    };
    loadFn(loadObject);
    // Only re-run when xml or autosave changes, or after initial init
  }, [isInitialized, xml, autosave, loadFn]);

  return (
    <div className="w-full h-full relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Draw.io editor...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-20 max-w-md">
          <p className="font-bold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={iframeUrl}
        className="w-full h-full border-0"
        title="Draw.io Editor"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
});

// Memoize to prevent rerenders when props are unchanged
export default memo(DrawioCanvas);
