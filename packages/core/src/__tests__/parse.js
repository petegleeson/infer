// @flow
import * as parser from "@babel/parser";
import containDeep from "jest-expect-contain-deep";
import { collector, resolver, boolT, funcT, intT, varT } from "../parse";

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

it("should infer arg function type", () => {
  const code = `x => x(true)`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const res = Object.keys(graph).map(k => ({
    [graph[k].node.type]: graph[k].type
  }));
  expect(res).toContainEqual({
    ArrowFunctionExpression: funcT([funcT([boolT()], varT("$1"))], varT("$1"))
  });
});

it("should infer identity call type", () => {
  const code = `(x => x)(1)`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const res = Object.keys(graph).map(k => ({
    [graph[k].node.type]: graph[k].type
  }));
  expect(res).toContainEqual({
    CallExpression: intT()
  });
  expect(res).toContainEqual({
    ArrowFunctionExpression: funcT([varT("x")], varT("x"))
  });
});

it("should infer multi arg function type", () => {
  const code = `(x, y) => y`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const res = Object.keys(graph).map(k => ({
    [graph[k].node.type]: graph[k].type
  }));
  expect(res).toContainEqual({
    ArrowFunctionExpression: funcT([varT("x"), varT("y")], varT("y"))
  });
});

it("should infer assignment", () => {
  const code = `const f = x => x`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const res = Object.keys(graph).map(k => ({
    [graph[k].node.type]: graph[k].type
  }));
  expect(res).toContainEqual({
    Identifier: funcT([varT("x")], varT("x"))
  });
});

it("should infer assignment then call expression", () => {
  const code = `
    const f = x => x;
    const i = f(1);
  `;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const res = Object.keys(graph).map(k => ({
    [graph[k].node.type]: graph[k].type
  }));
  expect(res).toContainEqual({
    Identifier: intT()
  });
});
