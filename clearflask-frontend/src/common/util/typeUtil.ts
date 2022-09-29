// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
export type Empty<T> = {
  [P in keyof T]?: undefined;
};

export type ThisButNotThat<THIS, THAT> = THIS & Empty<Omit<THAT, keyof THIS>>;

export type ThisOrThat<THIS, THAT> = ThisButNotThat<THIS, THAT> | ThisButNotThat<THAT, THIS>;
