// @flow
import traverse from "@babel/traverse";
import Graph, { map } from "./graph";

type Kind = "open" | "int" | "string";

export const ERROR = Symbol("CONSTRAINT_ERROR");
type ConstraintError = typeof ERROR;
type Constraint = Kind => Kind | ConstraintError;

type Node = Object;

type Vertex = {
  constraints: { node: Node, fn: Constraint }[],
  kind: Kind,
  node: Node
};

// const returnType = node => ({ kind: "Return", node });
// const openType = node => ({ kind: "Open", node });
// const intType = node => ({ kind: "Int", node });
// const funcType = node => ({ kind: "Func", node });
// const binaryExpressionType = node => ({
//   kind: "Expression",
//   node
// });

export const collector = ast => {
  const graph = new Graph();
  traverse(ast, {
    BinaryExpression: {
      exit(path) {
        const { left, right } = path.node;
        const type: Vertex = {
          node: path.node,
          kind: "int",
          constraints: []
        };

        graph.findNode(left).value.constraints.push({
          node: path.node,
          fn: type => (type === "open" || type === "int" ? "int" : ERROR)
        });
        graph.findNode(right).value.constraints.push({
          node: path.node,
          fn: type => (type === "open" || type === "int" ? "int" : ERROR)
        });
        graph.addVertex(type);

        graph.addLine(type.node, type.node.left);
        graph.addLine(type.node, type.node.right);
        path.data.type = type;
      }
    },
    Identifier: {
      exit(path) {
        const type: Vertex = {
          node: path.node,
          kind: "open",
          constraints: []
        };
        graph.addVertex(type);
        path.data.type = type;

        const binding = path.scope.bindings[type.node.name];
        if (binding && binding.identifier !== type.node) {
          graph.addLine(type.node, binding.identifier);
        }
      }
    },
    NumericLiteral: {
      exit(path) {
        const type: Vertex = {
          node: path.node,
          kind: "int",
          constraints: []
        };
        graph.addVertex(type);
        path.data.type = type;
      }
    },
    StringLiteral: {
      exit(path) {
        const type: Vertex = {
          node: path.node,
          kind: "string",
          constraints: []
        };
        graph.addVertex(type);
        path.data.type = type;
      }
    }
  });
  return graph;
};

export const resolver = graph => {
  return map(graph, v => ({
    ...v,
    value: {
      ...v.value,
      kind: v.value.constraints.reduce((a, c) => c.fn(a), v.value.kind)
    }
  }));
};
