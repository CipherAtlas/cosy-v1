export const dailyIndex = (size: number, date = new Date()): number => {
  const token = date.toISOString().slice(0, 10);
  let hash = 0;

  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) % 2147483647;
  }

  return hash % Math.max(size, 1);
};

export const nextRandomIndex = (size: number, current: number): number => {
  if (size <= 1) {
    return 0;
  }

  let next = current;
  while (next === current) {
    next = Math.floor(Math.random() * size);
  }

  return next;
};
