export const getMedianValue = (values: number[]) => {
  if (!values.length) return null;

  const sortedValues = [...values].sort((a, b) => a - b);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) return sortedValues[middleIndex] ?? null;

  const leftValue = sortedValues[middleIndex - 1];
  const rightValue = sortedValues[middleIndex];

  return leftValue !== undefined && rightValue !== undefined
    ? (leftValue + rightValue) / 2
    : null;
};

export const pushRollingSample = <TSample>(
  samples: TSample[],
  sample: TSample,
  maxSamples: number,
) => {
  samples.push(sample);

  if (samples.length > maxSamples) {
    samples.shift();
  }
};

export const getMedianSampleValue = <TSample>(
  samples: TSample[],
  getValue: (sample: TSample) => number,
) => getMedianValue(samples.map(getValue));
