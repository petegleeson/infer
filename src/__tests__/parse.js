// @flow
import * as parser from "@babel/parser";
import { map } from "../graph";
import { collector, resolver, ERROR, int, func, open } from "../parse";

it("should infer type of nodes", () => {
  const code = `n + 1;`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const inferred = resolver(graph);
  const types = inferred.vertices.map(({ value }) => ({
    [value.node.type]: value.kind
  }));
  expect(types).toEqual([
    { Identifier: int() },
    { NumericLiteral: int() },
    { BinaryExpression: int() }
  ]);
});

it("should error on binary expression", () => {
  const code = `'hello' + 1;`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const inferred = resolver(graph);
  const types = inferred.vertices.map(({ value }) => ({
    [value.node.type]: value.kind
  }));
  expect(types).toEqual([
    { StringLiteral: ERROR },
    { NumericLiteral: int() },
    { BinaryExpression: int() }
  ]);
});

it("should infer open function type", () => {
  const code = `function add(n) {
    return n;
  }`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const inferred = resolver(graph);
  const types = inferred.vertices.map(({ value }) => ({
    [value.node.type]: value.kind
  }));
  console.log(
    inferred.vertices
      .filter(
        ({ value }) =>
          value.node.type === "Identifier" ||
          value.node.type === "FunctionDeclaration"
      )
      .map(({ value }) => ({ kind: value.kind, name: value.node.name }))
  );
  expect(types).toContain([{ FunctionDeclaration: func([open()], open()) }]);
});

it("should infer function type", () => {
  const code = `function add(n) {
    return n + 1;
  }`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  console.log("graph", graph.edges);
  const inferred = resolver(graph);
  const types = inferred.vertices.map(({ node, kind }) => ({
    [node.type]: kind
  }));
  expect(types).toContain([{ FunctionDeclaration: func([int()], int()) }]);
});
