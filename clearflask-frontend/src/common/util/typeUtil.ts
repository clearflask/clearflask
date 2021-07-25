
export type Empty<T> = {
  [P in keyof T]?: undefined;
};

export type ThisButNotThat<THIS, THAT> = THIS & Empty<Omit<THAT, keyof THIS>>;

export type ThisOrThat<THIS, THAT> = ThisButNotThat<THIS, THAT> | ThisButNotThat<THAT, THIS>;
