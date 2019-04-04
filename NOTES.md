# Notes

Collection of my thoughts during the development of this project.

## 4/4/19

Things I want the project to do.

Only support a subset of JS. If I can have sound type system for modern JS langage features I will be happy.

Type annotations are completely optional. Annotations are used for the benefit of other developers. When you use annotations in Elm they improve the type error messages. Thats a cool feature.

Support a plugin system. Plugins should be able to provide inference information for language features not supported in core. Examples would be JSX, React (components are special functions because of default props) or the [pipline operator](https://github.com/tc39/proposal-pipeline-operator). This avoids the problem of React types being shipped inside the Flow languange.

Support different ways to "collect" the inferred AST. This provides flexibility for people to collect the typed AST into whatever makes sense for what they are building. At the moment the API looks like:

```js
// traversal returns a reducer function
// (acc, curr) => acc
const traverse = traversal(visitor, ast);

// collect to a map
const map = traverse(
  (acc, tNode) => ({
    ...acc,
    [tNode.id]: tNode
  }),
  {}
);
// collect to a list
const map = traverse((acc, tNode) => acc.concat(tNode), []);
// collect to a TypeScript Definition
const tsDef = traverse(toTSDefinition);
// collect to a Typed AST
const typedTree = traverse(toTree);
```

I am using currently collecting the typed AST into various forms to use in the LSP and tests. This is how I see TypeScript interop working.
