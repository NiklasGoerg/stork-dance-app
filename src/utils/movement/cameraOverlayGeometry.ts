export const getCoverGeometry = (
  sourceWidth: number,
  sourceHeight: number,
  viewportWidth: number,
  viewportHeight: number,
) => {
  const scale = Math.max(
    viewportWidth / sourceWidth,
    viewportHeight / sourceHeight,
  );
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;

  return {
    x: (viewportWidth - renderedWidth) / 2,
    y: (viewportHeight - renderedHeight) / 2,
    width: renderedWidth,
    height: renderedHeight,
  };
};
