/**
 * Query-string values arrive as strings. These helpers keep optional
 * booleans/numbers usable with class-validator decorators.
 */
export const optionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return value === true || value === 'true' || value === '1';
};

export const optionalNumber = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return Number(value);
};
