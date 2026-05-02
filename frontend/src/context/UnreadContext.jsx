import { createContext, useContext, useState, useCallback } from 'react';

const UnreadContext = createContext({ totalUnread: 0, setTotalUnread: () => {} });

export function UnreadProvider({ children }) {
  const [totalUnread, setTotalUnread] = useState(0);
  return (
    <UnreadContext.Provider value={{ totalUnread, setTotalUnread }}>
      {children}
    </UnreadContext.Provider>
  );
}

export const useUnread = () => useContext(UnreadContext);
