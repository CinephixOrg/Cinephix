let _io = null;

export const setIo = (ioInstance) => {
  _io = ioInstance;
};

export const getIo = () => _io;
