// @flow
import traverse from "@babel/traverse";
import Graph from "./graph";
import { existsTypeAnnotation } from "@babel/types";

const returnType = node => ({ kind: "Return", node });
const openType = node => ({ kind: "Open", node });
const intType = node => ({ kind: "Int", node });
const funcType = node => ({ kind: "Func", node });
const binaryExpressionType = node => ({
  kind: "Expression",
  node
});

let id = 0;
const getId = loc =>
  `${loc.start.line}${loc.start.column}${loc.end.line}${loc.end.column}`;

export const collector = ast => {
  const graph = new Graph();
  traverse(ast, {
    FunctionDeclaration: {
      enter(path) {
        const type = funcType(path.node);
        graph.addNode(type);
        path.data.type = type;
      }
    },
    BinaryExpression: {
      exit(path) {
        const { left, right } = path.node;
        const type = binaryExpressionType(path.node);
        graph.addNode(type);

        graph.addLine(type.node, type.node.left);
        graph.addLine(type.node, type.node.right);
        path.data.type = type;
      }
    },
    Identifier: {
      exit(path) {
        const type = openType(path.node);
        graph.addNode(type);
        path.data.type = type;

        const binding = path.scope.bindings[type.node.name];
        if (binding && binding.identifier !== type.node) {
          graph.addLine(type.node, binding.identifier);
        }
      }
    },
    NumericLiteral: {
      exit(path) {
        const type = intType(path.node);
        graph.addNode(type);
        path.data.type = type;
      }
    },
    ReturnStatement: {
      exit(path) {
        const type = returnType(path.node);
        graph.addNode(type);
        path.data.type = type;

        graph.addLine(type.node.argument, type.node);
        graph.addLine(type.node, path.getFunctionParent().node);
      }
    }
  });
  return graph;
};

export const getType = (graph, entry) => {
  switch (entry.value.kind) {
    case "Func": {
      const ret = graph.nodes.find(
        n => n.value.kind === "Return" && n.lines.includes(entry)
      );
      return `(${entry.value.node.params
        .map(param => getType(graph, graph.findNode(param)))
        .join(", ")}) => ${ret ? getType(graph, ret) : "void"}`;
    }
    case "Return": {
      return getType(graph, graph.findNode(entry.value.node.argument));
    }
    case "Expression": {
      return "Int";
    }
    case "Open": {
      const upper = graph.nodes.find(n => n.lines.includes(entry));

      return upper ? getType(graph, upper) : "Open";
    }
    case "Int": {
      return "Int";
    }
    default:
      return "";
  }
};
