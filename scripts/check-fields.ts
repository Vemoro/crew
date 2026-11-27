// Angepasst aus Vemoro/desk, scripts/check-fields.ts (AGPL-3.0-only).
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root=fileURLToPath(new URL('../',import.meta.url));
const controls=new Set(['input','select','textarea']);
function isHidden(node: ts.JsxOpeningLikeElement) {
  const properties = [...node.attributes.properties].reverse();
  const type = properties.find(attribute => ts.isJsxSpreadAttribute(attribute) || attribute.name.getText() === 'type');
  return node.tagName.getText() === 'input' && type && ts.isJsxAttribute(type) &&
    type.initializer && ts.isStringLiteral(type.initializer) && type.initializer.text === 'hidden';
}

function fieldRenderer(node:ts.Node) {
  let renderer:ts.ArrowFunction|undefined;
  for(let parent=node.parent;parent;parent=parent.parent) {
    if(ts.isFunctionLike(parent)) {
      if(renderer || !ts.isArrowFunction(parent)) return undefined;
      renderer=parent;
    }
    if(ts.isJsxElement(parent) && parent.openingElement.tagName.getText()==='Field') {
      if(renderer && ts.isJsxExpression(renderer.parent) && renderer.parent.parent===parent) return renderer;
      return undefined;
    }
  }
}

function fieldBinding(node: ts.JsxOpeningLikeElement, checker: ts.TypeChecker) {
  const renderer = fieldRenderer(node);
  const parameter = renderer?.parameters[0]?.name;
  if (!renderer || !parameter || !ts.isIdentifier(parameter)) return;
  const binding = checker.getSymbolAtLocation(parameter);
  if (!binding) return;
  const owned = new Set(['id', 'aria-describedby', 'aria-invalid', 'aria-label', 'aria-labelledby']);
  if (node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && owned.has(attribute.name.getText()))) return;
  const spreads = node.attributes.properties.filter(ts.isJsxSpreadAttribute);
  const [owner] = spreads;
  if (spreads.length === 1 && ts.isIdentifier(owner.expression) &&
    checker.getSymbolAtLocation(owner.expression) === binding) return renderer;
}

export function inspectFields(file:string,text:string) {
  const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  const options={jsx:ts.JsxEmit.Preserve,noResolve:true,noLib:true};
  const host=ts.createCompilerHost(options);
  host.getSourceFile=name=>name===file?source:undefined;
  const checker=ts.createProgram([file],options,host).getTypeChecker();
  const failures:string[]=[];
  const used = new Set<ts.ArrowFunction>();
  function visit(node:ts.Node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && controls.has(node.tagName.getText()) && !isHidden(node)) {
      const renderer = fieldBinding(node, checker);
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      if (!renderer) failures.push(`${file}:${line}: ${node.tagName.getText()} braucht ein gemeinsames Field mit unveränderten Attributen.`);
      else if (used.has(renderer)) failures.push(`${file}:${line}: Jedes sichtbare Eingabefeld braucht sein eigenes Field.`);
      else used.add(renderer);
    }
    ts.forEachChild(node,visit);
  }
  visit(source);
  return failures;
}

if(import.meta.main) {
  const violations:string[]=[];
  for(const path of new Bun.Glob('src/**/*.tsx').scanSync({cwd:root,dot:true})) {
    const file=path.replaceAll('\\','/');
    violations.push(...inspectFields(file,await Bun.file(join(root,file)).text()));
  }
  if(violations.length) {
    console.error(violations.join('\n'));
    process.exitCode=1;
  } else {
    console.log('Gemeinsame Formularfelder geprüft.');
  }
}
