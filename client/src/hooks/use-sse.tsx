import { useEffect, useState, useRef } from 'react';

interface UseSSEOptions {
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useSSE<T = any>(
  url: string | null,
  options: UseSSEOptions = {}
): T | null {
  const {
    reconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (!url || eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        console.log(`SSE connected to ${url}`);
      };

      eventSource.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          setData(parsedData);
        } catch (parseError) {
          console.warn('Failed to parse SSE data:', parseError);
          setData(event.data as T);
        }
      };

      eventSource.addEventListener('market_update', (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          setData(parsedData);
        } catch (parseError) {
          console.warn('Failed to parse market update:', parseError);
        }
      });

      eventSource.addEventListener('connected', (event) => {
        console.log('SSE connection confirmed:', event.data);
      });

      eventSource.onerror = (event) => {
        setIsConnected(false);
        
        if (eventSource.readyState === EventSource.CLOSED) {
          console.log('SSE connection closed');
          
          if (reconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current += 1;
            setError(`Connection lost. Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, reconnectInterval);
          } else {
            setError('Connection failed. Maximum reconnection attempts reached.');
          }
        } else {
          setError('SSE connection error occurred');
        }
      };

    } catch (err) {
      setError('Failed to establish SSE connection');
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setIsConnected(false);
    setData(null);
  };

  useEffect(() => {
    if (url) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [url]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  // Return only the data for simplicity
  // The component can check if data is null to determine connection status
  return data;
}

export default useSSE;
