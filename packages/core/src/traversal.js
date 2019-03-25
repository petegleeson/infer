// @flow
import * as t from "@babel/types";
import { getTypes } from "./types";
import {
  createCtx,
  applySubst,
  emptySubst,
  type Visitor,
  type Result as VisitorResult
} from "./parse";

type Node = { [k: string]: any };

type Arg = VisitorResult & {
  uid: string,
  path: { node: Node }
};

const explode = (visitor: Visitor): Visitor =>
  Object.keys(visitor).reduce((v, k) => {
    // change { T1|T2: fn } to { T1: fn, T2: fn }
    k.split("|").forEach(key => {
      const aliases = t.FLIPPED_ALIAS_KEYS[key];
      if (aliases) {
        // "Function" to ["ArrowFunctionExpression", "FunctionDeclaration"]
        aliases.forEach(a => {
          v[a] = visitor[k];
        });
      } else {
        v[key] = visitor[k];
      }
    });
    return v;
  }, {});

const traverse = (visitors: Visitor, node: Node, nextId) => {
  const types = getTypes(nextId);
  const nodeCache = (() => {
    let cache: { [uid: string]: Arg } = {};
    return {
      get: uid => cache[uid],
      set: (uid, arg) => (cache[uid] = arg),
      value: () => cache
    };
  })();

  const visit = (node, context) => {
    const visitNode = visitors[node.type];
    if (visitors[node.type]) {
      const result = visitors[node.type]({ node }, context, {
        visit,
        types
      });
      nodeCache.set(result.type.uid, {
        ...result,
        uid: result.type.uid,
        path: { node }
      });
      Object.keys(result.subst).forEach(uid => {
        const updateNode = nodeCache.get(uid);
        if (!updateNode) throw `cannot find node ${uid} in cache`;
        nodeCache.set(uid, {
          ...updateNode,
          type: applySubst(result.subst, updateNode.type)
        });
      });
      return result;
    }
    return (
      t.VISITOR_KEYS[node.type]
        .filter(k => node[k] !== undefined)
        // flatmap
        .reduce(
          (arr, k) => arr.concat(Array.isArray(node[k]) ? node[k] : [node[k]]),
          []
        )
        .reduce(
          (res, nextNode) => {
            // might want to compose and apply subst to context
            return visit(nextNode, context);
          },
          { subst: emptySubst(), type: types.voidT() }
        )
    );
  };
  visit(node, createCtx());

  return nodeCache.value();
};

export default function(
  visitor: Visitor,
  rootNode: Node,
  nextId: Node => string
) {
  // not usually nice thing to do to visitors
  const explodedVisitors = explode(visitor);
  const res = traverse(explodedVisitors, rootNode, nextId);

  return function<C>(reducer: (C, Arg) => C, initial: C) {
    return Object.keys(res)
      .map(k => res[k])
      .reduce(reducer, initial);
  };
}
