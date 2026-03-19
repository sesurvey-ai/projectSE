export const uploadService = {
  processFiles(files: Express.Multer.File[]) {
    return files.map(file => ({
      filename: file.filename,
      path: file.filename,
      size: file.size,
      mimetype: file.mimetype,
    }));
  },
};
