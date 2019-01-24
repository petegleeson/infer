// @flow
import traverse from "@babel/traverse";

type OpenKind = { type: "open" };
export const open = (): OpenKind => ({ type: "open" });

type IntKind = { type: "int" };
export const int = (): IntKind => ({ type: "int" });

type StringKind = { type: "string" };
export const string = (): StringKind => ({ type: "string" });

type FuncKind = { type: "func", params: Kind[], returns: Kind };
export const func = (
  params: Kind[] = [],
  returns: Kind = open()
): FuncKind => ({
  type: "func",
  params,
  returns
});

type Kind = OpenKind | IntKind | StringKind | FuncKind;

export const ERROR = Symbol("CONSTRAINT_ERROR");
type ConstraintError = typeof ERROR;
type Constraint = (from: Kind, to: Kind) => Kind | ConstraintError;

export const print = (kind: Kind) => {
  switch (kind.type) {
    case "func":
      return `${
        kind.params.length === 0 ? "()" : kind.params.map(print).join(" ,")
      } => ${print(kind.returns)}`;
    default:
      return kind.type;
  }
};

type Node = Object;

type Vertex = {
  kind: Kind,
  node: Node
};

type Edge = {
  from: Vertex,
  to: Vertex,
  constraint: Constraint
};

type Graph = {
  vertices: Vertex[],
  edges: Edge[]
};

const findVertex = (graph: Graph, node) => {
  const res = graph.vertices.find(vertex => vertex.node === node);
  if (!res) {
    console.log(node);
    throw Error("can't find node");
  }
  return res;
};

const addVertex = (graph: Graph, node) => {
  return {
    ...graph,
    vertices: [...graph.vertices, node]
  };
};

const replaceVertex = (graph: Graph, a: Vertex, b: Vertex) => {
  const pos = graph.vertices.indexOf(a);
  return {
    ...graph,
    vertices: [
      ...graph.vertices.slice(0, pos),
      b,
      ...graph.vertices.slice(pos + 1)
    ]
  };
};

const addEdge = (graph: Graph, { from, to, constraint }: Edge) => {
  return {
    ...graph,
    edges: [...graph.edges, { from, to, constraint }]
  };
};

const filterEdges = (graph: Graph, fn) => {
  return graph.edges.filter(fn);
};

const createGraph = () => ({
  vertices: [],
  edges: []
});

const map = (graph, fn) => ({
  vertices: graph.vertices.map(fn),
  edges: graph.edges
});

export const collector = ast => {
  let graph = createGraph();
  traverse(ast, {
    ArrowFunctionExpression: {
      enter(path) {
        const { id, params } = path.node;
        const me: Vertex = {
          node: path.node,
          kind: func(params.map(open))
        };

        graph = addVertex(graph, me);
      },
      exit(path) {
        const me = findVertex(graph, path.node);
        if (path.node.body.type !== "BlockExpression") {
          const body = findVertex(graph, path.node.body);
          graph = addEdge(graph, {
            from: body,
            to: me,
            constraint: (from, to) =>
              to.type === "func" ? func(to.params, from) : ERROR
          });
        }
        graph = me.node.params
          .map((param, i) => ({
            from: findVertex(graph, param),
            to: me,
            constraint: (from, to) => {
              const { params, returns } = to;
              return func(
                [...params.slice(0, i), from, ...params.slice(i + 1)],
                returns
              );
            }
          }))
          .reduce((g, edge) => addEdge(g, edge), graph);
      }
    },
    BinaryExpression: {
      exit(path) {
        const { left, right } = path.node;
        const me: Vertex = {
          node: path.node,
          kind: int()
        };
        path.data.type = me;
        graph = addVertex(graph, me);

        graph = addEdge(graph, {
          from: me,
          to: findVertex(graph, left),
          constraint: (from, to) =>
            to.type === "open" || to.type === "int" ? int() : ERROR
        });

        graph = addEdge(graph, {
          from: me,
          to: findVertex(graph, right),
          constraint: (from, to) =>
            to.type === "open" || to.type === "int" ? int() : ERROR
        });
      }
    },
    CallExpression: {
      exit(path) {
        const me: Vertex = {
          node: path.node,
          kind: open()
        };
        path.data.type = me;

        graph = addVertex(graph, me);

        const callee = findVertex(graph, path.node.callee);
        const constrained =
          filterEdges(graph, ({ from, to }) => to === callee).length > 0;
        graph = constrained
          ? addEdge(graph, {
              from: callee,
              to: me,
              constraint: (from, to) =>
                from.type === "func" ? from.returns : ERROR
            })
          : addEdge(graph, {
              from: me,
              to: callee,
              constraint: (from, to) =>
                func(path.node.arguments.map(open), from)
            });

        graph = me.node.arguments
          .map((arg, i) => ({
            from: findVertex(graph, arg),
            to: callee,
            constraint: (from, to) => {
              const { params, returns } = to;
              return to.type === "func" &&
                (params[i].type === "open" || params[i].type === from.type)
                ? func(
                    [...params.slice(0, i), from, ...params.slice(i + 1)],
                    returns
                  )
                : ERROR;
            }
          }))
          .reduce((g, edge) => addEdge(g, edge), graph);
      }
    },
    Identifier: {
      exit(path) {
        const me: Vertex = {
          node: path.node,
          kind: open()
        };
        path.data.type = me;

        graph = addVertex(graph, me);

        const binding = path.scope.bindings[me.node.name];
        if (binding && binding.identifier !== me.node) {
          const parentVertex = findVertex(graph, binding.identifier);
          // likely will need more sophisticated check for whether the
          // type of the parent node as been decided on
          const constrained =
            filterEdges(graph, ({ from, to }) => to === parentVertex).length >
            0;
          graph = addEdge(graph, {
            from: constrained ? parentVertex : me,
            to: constrained ? me : parentVertex,
            constraint: from => from
          });
        }
      }
    },
    FunctionDeclaration: {
      enter(path) {
        const { id, params } = path.node;
        const me: Vertex = {
          node: path.node,
          kind: func(params.map(open))
        };

        graph = addVertex(graph, me);
      },
      exit(path) {
        const me = findVertex(graph, path.node);
        if (path.node.id) {
          const id = findVertex(graph, path.node.id);
          graph = addEdge(graph, {
            from: me,
            to: id,
            constraint: from => from
          });
        }
        graph = me.node.params
          .map((param, i) => ({
            from: findVertex(graph, param),
            to: me,
            constraint: (from, to) => {
              const { params, returns } = to;
              return func(
                [...params.slice(0, i), from, ...params.slice(i + 1)],
                returns
              );
            }
          }))
          .reduce((g, edge) => addEdge(g, edge), graph);
      }
    },
    NumericLiteral: {
      exit(path) {
        const me: Vertex = {
          node: path.node,
          kind: int()
        };
        path.data.type = me;

        graph = addVertex(graph, me);
      }
    },
    ReturnStatement: {
      exit(path) {
        const me: Vertex = {
          node: path.node,
          kind: open()
        };
        path.data.type = me;

        graph = addVertex(graph, me);

        const parentFunction = findVertex(graph, path.getFunctionParent().node);
        graph = addEdge(graph, {
          from: me,
          to: parentFunction,
          constraint: (from, to) =>
            to.type === "func" ? func(to.params, from) : ERROR
        });

        const arg = findVertex(graph, path.node.argument);
        graph = addEdge(graph, {
          from: arg,
          to: me,
          constraint: from => from
        });
      }
    },
    StringLiteral: {
      exit(path) {
        const me: Vertex = {
          node: path.node,
          kind: string()
        };
        path.data.type = me;

        graph = addVertex(graph, me);
      }
    },
    VariableDeclarator: {
      exit(path) {
        const { id, init } = path.node;
        graph = addEdge(graph, {
          from: findVertex(graph, init),
          to: findVertex(graph, id),
          constraint: from => from
        });
      }
    }
  });
  return graph;
};

const constrain = (graph: Graph, vertex: Vertex): Vertex => {
  const edges = graph.edges.filter(({ to }) => to === vertex);
  // console.log("vertex", vertex);
  // console.log("edges", edges.map(({ from }) => from));
  if (edges.length === 0) {
    return vertex;
  }
  // infer vertex type
  const kind = edges.reduce(
    (k, edge) => edge.constraint(constrain(graph, edge.from).kind, k),
    vertex.kind
  );
  // update vertex in graph
  return { ...vertex, kind };
};

export const resolver = (graph: Graph) => {
  return graph.vertices.reduce((g, vertex) => {
    const updated = constrain(g, vertex);
    // console.log("updated vertex", updated);
    return replaceVertex(g, vertex, updated);
  }, graph);
};
