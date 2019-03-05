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
        kind.params.length === 0
          ? "()"
          : `(${kind.params.map(print).join(" ,")})`
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

const cloneVertex = (a: Vertex): Vertex => {
  const deepClone = obj =>
    Object.keys(obj).reduce((clone, key) => {
      if (Array.isArray(obj[key])) {
        clone[key] = obj[key].map(deepClone);
      } else if (typeof obj[key] === "object") {
        clone[key] = deepClone(obj[key]);
      } else {
        clone[key] = obj[key];
      }
      return clone;
    }, {});
  return {
    node: a.node,
    kind: deepClone(a.kind),
    copy: true
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
  if (from.node === to.node) {
    throw Error("cannot add edge between same node");
  }
  return {
    ...graph,
    edges: [...graph.edges, { from, to, constraint }]
  };
};

const removeEdge = (graph: Graph, edge: Edge) => {
  return {
    ...graph,
    edges: graph.edges.filter(e => e !== edge)
  };
};

const filterEdges = (graph: Graph, fn) => {
  return graph.edges.filter(fn);
};

const createGraph = () => ({
  vertices: [],
  edges: []
});

const mergeGraphs = (a: Graph, b: Graph) => ({
  vertices: [...a.vertices, ...b.vertices],
  edges: [...a.edges, ...b.edges]
});

const follow = (graph, vertex, fn) => {
  const visit = (v, visited = []) => {
    const outgoing = filterEdges(graph, ({ from }) => from === v);
    const incoming = filterEdges(graph, ({ to }) => to === v);
    const unseen = !visited.includes(v);
    if (unseen) {
      fn(v, { outgoing, incoming });
    }
    return incoming.reduce(
      (vs, e) => visit(e.from, vs),
      unseen ? visited.concat(v) : visited
    );
  };
  visit(vertex);
};

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
        const incoming = filterEdges(graph, ({ from, to }) => to === callee);
        const constrained = incoming.length > 0;
        if (constrained) {
          const [{ from: start }] = incoming;

          let declaration;
          let copied = createGraph();
          // copy vertices
          follow(graph, start, v => {
            if (!declaration && v.kind.type === "func") {
              declaration = v;
            }
            const clone = cloneVertex(v);
            copied = addVertex(copied, clone);
          });
          // copy edges
          follow(graph, start, (v, e) => {
            copied = e.incoming.reduce((g, { from, to, constraint }) => {
              return addEdge(g, {
                from: findVertex(g, from.node),
                to: findVertex(g, to.node),
                constraint
              });
            }, copied);
          });

          // swap direction of edges pointing to arguments
          copied = me.node.arguments
            .map((arg, i) => findVertex(copied, declaration.node.params[i]))
            .reduce((g, vertex) => {
              const into = filterEdges(
                g,
                ({ to, from }) => to === vertex && from.kind.type !== "func"
              );
              const removed = into.reduce(removeEdge, g);
              return into.reduce(
                (x, { from, to, constraint }) =>
                  addEdge(x, {
                    from: to,
                    to: from,
                    constraint
                  }),
                removed
              );
            }, copied);

          graph = mergeGraphs(graph, copied);

          // link arguments
          graph = me.node.arguments
            .map((arg, i) => ({
              from: findVertex(graph, arg),
              to: findVertex(copied, declaration.node.params[i]),
              constraint: (from, to) => {
                // console.log("constraining param", from);
                return to.type === "open" || to.type === from.type
                  ? from
                  : ERROR;
              }
            }))
            .reduce((g, edge) => addEdge(g, edge), graph);

          // link callee's return type to me
          graph = addEdge(graph, {
            from: callee,
            to: me,
            constraint: (from, to) =>
              from.type === "func" ? from.returns : ERROR
          });
          // link callee to copied graph
          graph = removeEdge(graph, incoming[0]);
          graph = addEdge(graph, {
            from: findVertex(copied, start.node),
            to: callee,
            constraint: from => from
          });
        } else {
          graph = addEdge(graph, {
            from: me,
            to: callee,
            constraint: (from, to) => func(path.node.arguments.map(open), from)
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
  if (edges.length === 0) {
    return vertex;
  }
  // infer vertex type
  const kind = edges.reduce(
    (k, edge) => edge.constraint(constrain(graph, edge.from).kind, k),
    vertex.kind
  );
  return { ...vertex, kind };
};

export const resolver = (graph: Graph) => {
  return graph.vertices.reduce((g, vertex) => {
    const updated = constrain(g, vertex);
    return replaceVertex(g, vertex, updated);
  }, graph);
};
