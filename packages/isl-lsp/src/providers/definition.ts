/**
 * Definition Provider
 * 
 * Provides go-to-definition functionality for ISL documents.
 */

import { Definition, Location, Position, Range } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLLanguageService } from '../services/language-service.js';

export class DefinitionProvider {
  private languageService: ISLLanguageService;

  constructor(languageService: ISLLanguageService) {
    this.languageService = languageService;
  }

  provideDefinition(document: TextDocument, position: Position): Definition | null {
    const content = document.getText();
    const word = this.languageService.getWordAtPosition(content, position);
    if (!word) return null;

    const doc = this.languageService.getDocument(document.uri);
    if (!doc?.ast) return null;

    // Search for definition
    for (const entity of doc.ast.entities) {
      if (entity.name === word) {
        return Location.create(document.uri, entity.range);
      }
    }

    for (const type of doc.ast.types) {
      if (type.name === word) {
        return Location.create(document.uri, type.range);
      }
    }

    for (const enumNode of doc.ast.enums) {
      if (enumNode.name === word) {
        return Location.create(document.uri, enumNode.range);
      }
    }

    for (const behavior of doc.ast.behaviors) {
      if (behavior.name === word) {
        return Location.create(document.uri, behavior.range);
      }
    }

    return null;
  }
}
