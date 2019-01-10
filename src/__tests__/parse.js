// @flow
import * as parser from "@babel/parser";
import containDeep from "jest-expect-contain-deep";
import { map } from "../graph";
import { collector, resolver, ERROR, int, func, open } from "../parse";

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
      { BinaryExpression: int() }
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
