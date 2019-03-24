// @flow
import * as t from "@babel/types";
import {
  type Visitor,
  type VisitResult,
  type VisitorApi,
  type Context,
  composeSubst,
  createCtx,
  emptySubst,
  voidT
} from "./parse";

type BabelNode = { [k: string]: any };

const varTId = () => {
  let id = 0;
  return () => `$${++id}`;
};

const uid = () => {
  let id = 0;
  return () => ++id;
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

const traversal = function(
  visitor: Visitor,
  rootNode: BabelNode,
  rootContext: Context = createCtx()
) {
  const visitors = explode(visitor);
  const getVarTId = varTId();
  let nodes;
  const collect = function<C>(
    reduce: (C, VisitResult & { node: BabelNode }) => C,
    initial: C
  ) {
    let collected = initial;
    const visit = (node: BabelNode, context: Context): VisitResult => {
      if (node.type === undefined || context === undefined)
        throw "cannot visit undefined node";
      const visitNode = visitors[node.type];
      // console.log("n", n.type, visit);
      // console.log(node, t.VISITOR_KEYS[node.type]);
      if (visitNode) {
        const res = visitNode({ node }, context, { visit, getVarTId });
        collected = reduce(collected, { ...res, node });
        return res;
      } else if (0 < t.VISITOR_KEYS[node.type].length) {
        return (
          t.VISITOR_KEYS[node.type]
            .filter(k => node[k] !== undefined)
            // flatmap
            .reduce(
              (arr, k) =>
                arr.concat(Array.isArray(node[k]) ? node[k] : [node[k]]),
              []
            )
            .reduce(
              (res, nextNode) => {
                // might want to compose and apply subst to context
                console.log("auto visiting", nextNode);
                return visit(nextNode, context);
              },
              { subst: emptySubst(), type: voidT() }
            )
        );
      }
      return { subst: emptySubst(), type: voidT() };
    };
    visit(rootNode, rootContext);
    return collected;
  };
  return collect;
};

// const traversal = function<C>(reduce: (C, VisitResult) => C, initial: C) {
//   let coll = initial;
//   let nodes = {};
//   const traverse = function(
//     visitor: Visitor,
//     node: BabelNode,
//     state: $Call<typeof emptyState> = emptyState()
//   ): C {
//     const fn = visitor[node.type];
//     if (fn) {
//       // problem is visitors expect a VistorResult to be returned from traverse.
//       // caller of traversal whats the result in however they wish to collect it.
//       const res = fn({ node }, state, { recurse });
//       coll = reduce(initial, res);
//       return coll;
//     }
//     return initial;
//   };

//   return traverse;
// };

export default traversal;
