import { describe, expect, it } from 'vitest';
import { toCsv } from '../src/shared/csv';

describe('toCsv', () => {
  it('quotes only cells that need it and starts with a BOM', () => {
    expect(
      toCsv([
        ['email', 'company'],
        ['ann@acme.com', 'Acme, "Inc"'],
        ['ivan@приклад.укр', 'ТОВ\nПриклад'],
      ]),
    ).toBe('﻿email,company\r\nann@acme.com,"Acme, ""Inc"""\r\nivan@приклад.укр,"ТОВ\nПриклад"\r\n');
  });
});
