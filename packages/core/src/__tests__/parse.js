// @flow
import * as parser from "@babel/parser";
import containDeep from "jest-expect-contain-deep";
import { collector, resolver, funcT, intT, varT } from "../parse";

it("should infer identity function type", () => {
  const code = `x => x`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const res = Object.keys(graph).map(k => ({
    [graph[k].node.type]: graph[k].type
  }));
  expect(res).toContainEqual({
    ArrowFunctionExpression: funcT([varT("x")], varT("x"))
  });
});

it("should infer identity call expression", () => {
  const code = `(x => x)(1)`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const res = Object.keys(graph).map(k => ({
    [graph[k].node.type]: graph[k].type
  }));
  expect(res).toContainEqual({
    CallExpression: intT()
  });
});
