export default class Graph {
  /**
   * We'll hold onto all of our nodes in a regular JavaScript array. Not
   * because there is any particular order to the nodes but because we need a
   * way to store references to everything.
   */

  constructor() {
    this.nodes = [];
  }

  /**
   * We can start to add values to our graph by creating nodes without any
   * lines.
   */

  addNode(value) {
    return this.nodes.push({
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

  find(value) {
    return this.nodes.find(node => {
      return node.value === value;
    });
  }

  findIdentifer(identifier) {
    return this.nodes.find(
      node => node.value.node && node.value.node.name === identifier.name
    );
  }

  findNode(node) {
    return this.nodes.find(n => n.value.node === node);
  }

  /**
   * Next we can connect two nodes by making a "line" from one to the other.
   */

  addLine(startValue, endValue) {
    // Find the nodes for each value.
    let startNode = this.findNode(startValue);
    let endNode = this.findNode(endValue);

    // Freak out if we didn't find one or the other.
    if (!startNode || !endNode) {
      throw new Error("Both nodes need to exist");
    }

    // And add a reference to the endNode from the startNode.
    startNode.lines.push(endNode);
  }
}
