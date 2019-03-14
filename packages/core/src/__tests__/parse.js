// @flow
import * as parser from "@babel/parser";
import containDeep from "jest-expect-contain-deep";
import {
  collector,
  resolver,
  ERROR,
  int,
  func,
  open,
  string,
  binOp
} from "../parse";

it("should infer type of nodes", () => {
  const code = `n + 1;`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const inferred = resolver(graph);
  const types = inferred.vertices.map(({ node, kind }) => ({
    [node.type]: kind
  }));
  expect(types).toEqual(
    containDeep([
      { Identifier: int() },
      { NumericLiteral: int() },
      { BinaryExpression: binOp(int()) }
    ])
  );
});

it("should infer open function type", () => {
  const code = `function add(n) {
    return n;
  }`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const inferred = resolver(graph);
  const types = inferred.vertices.map(({ node, kind }) => ({
    [node.type]: kind
  }));
  expect(types).toEqual(
    containDeep([{ FunctionDeclaration: func([open()], open()) }])
  );
});

it("should infer function type", () => {
  const code = `function add(n) {
    return n + 1;
  }`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const inferred = resolver(graph);
  const types = inferred.vertices.map(({ node, kind }) => ({
    [node.type]: kind
  }));
  expect(types).toEqual(
    containDeep([{ FunctionDeclaration: func([int()], int()) }])
  );
});

it("should infer arrow function type", () => {
  const code = `const f = () => "hello"`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const inferred = resolver(graph);
  const types = inferred.vertices.map(({ node, kind }) => ({
    [node.type]: kind
  }));
  expect(types).toEqual(containDeep([{ Identifier: func([], string()) }]));
});

it("should infer argument function type", () => {
  const code = `const f = b => b("hello") + 1`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const inferred = resolver(graph);
  const types = inferred.vertices.map(({ node, kind }) => ({
    [node.type]: kind
  }));
  expect(types).toEqual(
    containDeep([
      { Identifier: func([string()], int()) },
      { Identifier: func([func([string()], int())], int()) }
    ])
  );
});

it("should infer function call type", () => {
  const code = `
    const f = () => "hello";
    const b = f();
  `;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const inferred = resolver(graph);
  const types = inferred.vertices.map(({ node, kind }) => ({
    [node.type]: kind
  }));
  expect(types).toEqual(
    containDeep([{ Identifier: func([], string()) }, { Identifier: string() }])
  );
});

it("should error function call type", () => {
  const code = `
    const add = (a, b) => a + b;
    const b = add(1, "hi");
  `;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const inferred = resolver(graph);
  const types = inferred.vertices.map(({ node, kind }) => ({
    [node.type]: kind
  }));
  expect(types).toEqual(
    containDeep([
      { Identifier: ERROR },
      { Identifier: func([int(), int()], int()) }
    ])
  );
});

it("should narrow function call type", () => {
  const code = `
    const i = (a) => a;
    const b = i(1);
  `;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const inferred = resolver(graph);
  const types = inferred.vertices.map(({ node, kind }) => ({
    [node.type]: kind
  }));
  expect(types).toEqual(
    expect.arrayContaining([
      { Identifier: func([open()], open()) },
      { Identifier: func([int()], int()) }
    ])
  );
});
