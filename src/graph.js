// @flow

// type Vertex<T> = {
//   value: T
// };

// type Edge<T> = {
//   to: Vertex<T>,
//   from: Vertex<T>
// };

// type Graph<T> = {
//   vertices: Vertex<T>[],
//   edges: Edge<T>[]
// };

// const graph = <T>(): Graph<T> => ({ vertices: [], edges: [] });

// type AddVertex = <T>(Graph<T>, Vertex<T>) => Graph<T>;
// const addVertex: AddVertex = (edge, vertex) => ({  })

// type addEdge = <T>(Graph<T>, Edge<T>) => Graph<T>;

export default class Graph {
  /**
   * We'll hold onto all of our nodes in a regular JavaScript array. Not
   * because there is any particular order to the nodes but because we need a
   * way to store references to everything.
   */

  constructor() {
    this.vertices = [];
  }

  /**
   * We can start to add values to our graph by creating nodes without any
   * lines.
   */

  addVertex(value) {
    return this.vertices.push({
      value,
      lines: []
    });
  }

  /**
   * Next we need to be able to lookup nodes in the graph. Most of the time
   * you'd have another data structure on top of a graph in order to make
   * searching faster.
   *
   * But for our case, we're simply going to search through all of the nodes to find
   * the one with the matching value. This is a slower option, but it works for
   * now.
   */

  find(fn) {
    return this.vertices.find(fn);
  }

  findNode(node) {
    return this.find(v => v.value.node === node);
  }

  /**
   * Next we can connect two nodes by making a "line" from one to the other.
   */

  addLine(startNode, endNode) {
    // Find the nodes for each value.
    let startVertex = this.findNode(startNode);
    let endVertex = this.findNode(endNode);

    // Freak out if we didn't find one or the other.
    if (!startVertex) {
      throw new Error("Start vertex not found");
    }
    if (!endVertex) {
      throw new Error("End vertex not found");
    }

    // And add a reference to the endNode from the startNode.
    startVertex.lines.push(endVertex);
  }
}
