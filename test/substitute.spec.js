'use strict';

const { ADD, SUB, MUL } = require('../src/operations');
const {
  Var,
  Let,
  Literal,
  Operation,
  Fun,
  FunCall,
} = require('../src/expressions');
const substitute = require('../src/substitute');

test('Should nothing replace', () => {
  // let x = 10 in 11
  const name = 'x';
  const value = new Literal(10);
  const expr = new Literal(11);
  const result = substitute(value, name, expr);
  expect(result).toEqual(new Literal(11));
});

test('Should replace variable with a value when its name matches', () => {
  // let x = 10 in x
  const name = 'x';
  const value = new Literal(10);
  const expr = new Var(name);
  const result = substitute(value, name, expr);
  expect(result).toEqual(new Literal(10));
});

test('Should return varible when its name does not matches', () => {
  // let x = 10 in y
  const [name, another] = ['x', 'y'];
  const value = new Literal(10);
  const expr = new Var(another);
  expect(substitute(value, name, expr)).toEqual(expr);
});

test('Should replace variable in operation expression', () => {
  const testCases = [
    {
      /**
       * let x = 2 in x + 1
       * [name: x; value: 2; expr: x + 1]
       * -> 2 + 1
       */
      name: 'x',
      value: new Literal(2),
      freeValue: new Literal(1),

      get expr() {
        const { name, freeValue } = this;
        return new Operation(new Var(name), ADD, freeValue);
      },

      get expected() {
        const { value, freeValue } = this;
        return new Operation(value, ADD, freeValue);
      },
    },
    {
      /**
       * let x = -2 in 10 - x
       * [name: x; value: -2; expr: 10 - 2]
       * -> 10 - (-2)
       */
      name: 'y',
      value: new Literal(-2),
      freeValue: new Literal(10),

      get expr() {
        const { name, freeValue } = this;
        return new Operation(freeValue, SUB, new Var(name));
      },

      get expected() {
        const { value, freeValue } = this;
        return new Operation(freeValue, SUB, value);
      },
    },
    {
      /**
       * let x = 10 in x * x
       * [name: x; value: 10; expr: x * x]
       * -> 10 * 10
       */
      name: 'x',
      value: new Literal(10),

      get expr() {
        const { name } = this;
        return new Operation(new Var(name), MUL, new Var(name));
      },

      get expected() {
        const { value } = this;
        return new Operation(value, MUL, value);
      },
    },
    {
      /**
       * let x = 10 in (x - (-2)) + x
       * [name: x; value: 10; expr: (x - (-2)) + x]
       * -> (10 - (-2)) + 10
       */
      name: 'x',
      value: new Literal(10),
      freeValue: new Literal(-2),

      get expr() {
        const { name, freeValue } = this;
        return new Operation(
          new Operation(new Var(name), SUB, freeValue),
          ADD,
          new Var(name),
        );
      },

      get expected() {
        const { value, freeValue } = this;
        return new Operation(new Operation(value, SUB, freeValue), ADD, value);
      },
    },
    {
      /**
       * let x = (let y = 10 in y) in x + x
       * [name: x; value: let y = 10 in y; expr: x + x]
       * -> (let y = 10 in y) + (let y = 10 in y)
       */
      name: 'x',
      value: new Let('y', new Literal(10), new Var('y')),

      get expr() {
        const { name } = this;
        return new Operation(new Var(name), ADD, new Var(name));
      },

      get expected() {
        const { value } = this;
        return new Operation(value, ADD, value);
      },
    },
  ];

  testCases.forEach(({ value, name, expr, expected }) => {
    const result = substitute(value, name, expr);
    expect(result).toEqual(expected);
  });
});

test('Should implement scoping rules correctly', () => {
  /**
   * let x = 12 in let x = x * x in x
   * [name: x; value: 12; expr: let x = x * x in x]
   * -> let x = 12 * 12 in x
   * WRONG: let x = 12 * 12 in 12
   */
  const name = 'x';
  const value = new Literal(12);

  const expr = new Let(
    name,
    new Operation(new Var(name), MUL, new Var(name)),
    new Var(name),
  );

  const expected = new Let(
    name,
    new Operation(value, MUL, value),
    new Var(name),
  );

  expect(substitute(value, name, expr)).toEqual(expected);
});

test('Should work with nested let-in expression correctly', () => {
  const testCases = [
    {
      /**
       * let x = 1 + 2 in let y = x + 1 in y * x
       * [name: x; value: 1 + 2; expr: let y = x + 1 in y * x]
       * -> let y = (1 + 2) + 1 in y * (1 + 2)
       */
      name: 'x',
      value: new Operation(new Literal(1), ADD, new Literal(2)),

      get expr() {
        const { name } = this;
        return new Let(
          'y',
          new Operation(new Var(name), ADD, new Literal(1)),
          new Operation(new Var('y'), MUL, new Var(name)),
        );
      },

      get expected() {
        const { value } = this;
        return new Let(
          'y',
          new Operation(value, ADD, new Literal(1)),
          new Operation(new Var('y'), MUL, value),
        );
      },
    },
  ];

  testCases.forEach(({ name, value, expr, expected }) => {
    expect(substitute(value, name, expr)).toEqual(expected);
  });
});

test('Should work with function call correctly', () => {
  const increment = new Fun(
    'x',
    new Operation(new Var('x'), ADD, new Literal(1)),
  );
  const square = new Fun('x', new Operation(new Var('x'), MUL, new Var('x')));

  const testCases = [
    {
      /**
       * let f = fun x -> x + 1 in f 10
       * [name: f; value: fun x -> x + 1; expr: f 10]
       * eval(fun x -> x + 1) = fun x -> x + 1, then substitute
       * -> (fun x -> x + 1) 10
       */
      name: 'f',
      value: increment,
      freeValue: new Literal(10),
      get expr() {
        const { name, freeValue } = this;
        return new FunCall(new Var(name), freeValue);
      },
      get expected() {
        const { value, freeValue } = this;
        return new FunCall(value, freeValue);
      },
    },
    {
      /**
       * let g = fun x -> x * x in g
       * eval(fun x -> x * x), then substitute
       * -> fun x -> x * x
       */
      name: 'g',
      value: square,
      get expr() {
        return new Var('g');
      },
      get expected() {
        return this.value;
      },
    },
  ];

  testCases.forEach(({ value, name, expr, expected }) => {
    expect(substitute(value, name, expr)).toEqual(expected);
  });
});
