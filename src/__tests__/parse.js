// @flow
import * as parser from "@babel/parser";
import { map } from "../graph";
import { collector, resolver, getType, ERROR, infer } from "../parse";

it("should infer type of nodes", () => {
  const code = `n + 1;`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const inferred = resolver(graph);
  const types = inferred.vertices.map(({ value }) => ({
    [value.node.type]: value.kind
  }));
  expect(types).toEqual([
    { Identifier: "int" },
    { NumericLiteral: "int" },
    { BinaryExpression: "int" }
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
    { NumericLiteral: "int" },
    { BinaryExpression: "int" }
  ]);
});
