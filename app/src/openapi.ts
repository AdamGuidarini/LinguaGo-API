import type { OpenAPIV3 } from 'openapi-types';

/**
 * Central OpenAPI document for LinguaGo API.
 *
 * express-openapi serves this as JSON at GET /api-docs (default docsPath).
 *
 * Starter state: only GET /translators is documented, as the worked example.
 * To document another endpoint:
 *   1. add a path entry here (path -> method -> operationId + responses)
 *   2. add a handler under that operationId in the `operations` map in index.ts
 *      (and remove the old inline route for that path)
 */
export const apiDoc: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'LinguaGo API',
    version: '1.0.0',
    description: 'Translation API proxying the Apertium and LibreTranslate backends.',
    license: { name: 'GPL-3.0-only' },
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'meta', description: 'Service metadata and health' },
    { name: 'translators', description: 'Translation backends' },
    { name: 'translate', description: 'Translation endpoints' },
  ],
  paths: {
    '/': {
      get: {
        operationId: 'root',
        tags: ['root'],
        summary: 'Root endpoint, provides name and status',
        responses: {
          '200': {
            description: 'ok',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'linguago-api' },
                    status: { type: 'string', example: 'ok' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/health': {
      get: {
        operationId: 'health',
        tags: ['meta'],
        summary: 'Basic API health check',
        responses: {
          '200': {
            description: 'API is up and running',
            content: {
              'text/plain': {
                schema: {
                  type: 'string',
                  example: 'ok'
                }
              }
            }
          }
        }
      }
    },
    '/translators': {
      get: {
        operationId: 'listTranslators',
        tags: ['translators'],
        summary: 'List the available translation backends',
        responses: {
          '200': {
            description: 'Available translation backends',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Translator' },
                },
              },
            },
          },
        },
      },
    },
    '/translate': {
      post: {
        operationId: 'translate',
        tags: ['translate'],
        summary: 'Translates provided text from source to target',
        requestBody: {
          description: 'Text to translate, source/target languages, and which backend to use',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UnifiedTranslationRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Translated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Translation' }
              }
            }
          },
          '400': {
            description: 'Invalid translator'
          }
        }
      }
    },
    '/apertium/translate': {
      post: {
        operationId: 'apertium-translate',
        tags: ['apertium', 'translate'],
        summary: 'Translates provided text from source to target in Apertium',
        requestBody: {
          description: 'Text to translate, source/target languages in Apertium',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TranslationRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Translated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Translation' }
              }
            }
          }
        }
      }
    },
    '/apertium/languages': {
      get: {
        operationId: 'apertium-languages',
        tags: ['languages', 'apertium'],
        summary: 'Retrieves Apertium\'s supported language pairs',
        responses: {
          '200': {
            description: 'Successfully retrieved support language pairs',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Language' }
                }
              }
            }
          }
        }
      }
    },
    '/libretranslate/translate': {
      post: {
        operationId: 'libretranslate-translate',
        tags: ['libretranslate', 'translate'],
        summary: 'Translates provided text from source to target in libretranslate',
        requestBody: {
          description: 'Text to translate, source/target languages in libretranslate',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TranslationRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Translated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Translation' }
              }
            }
          }
        }
      }
    },
    '/libretranslate/languages': {
      get: {
        operationId: 'libretranslate-languages',
        tags: ['languages', 'libretranslate'],
        summary: 'Retrieves LibreTranslate\'s supported language pairs',
        responses: {
          '200': {
            description: 'Successfully retrieved support language pairs',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Language' }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      Translator: {
        type: 'string',
        enum: ['apertium', 'libretranslate'],
      },
      Language: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code: { type: 'string', example: 'en' },
          name: { type: 'string', example: 'English' },
          targets: {
            type: 'array',
            items: { type: 'string' },
            example: ['es', 'fr'],
          },
        },
      },
      TranslationRequest: {
        type: 'object',
        required: ['source', 'target', 'text'],
        properties: {
          source: { type: 'string', minLength: 1, example: 'en' },
          target: { type: 'string', minLength: 1, example: 'es' },
          text: { type: 'string', minLength: 1, example: 'Hello world' },
        },
      },
      // POST /translate body: a TranslationRequest plus the backend to use.
      // `translator` is a plain string here (not the enum) on purpose: an
      // unknown value must reach the route handler so it can return the
      // custom "translator must be one of: ..." message.
      UnifiedTranslationRequest: {
        allOf: [
          { $ref: '#/components/schemas/TranslationRequest' },
          {
            type: 'object',
            required: ['translator'],
            properties: {
              translator: { type: 'string', example: 'apertium' },
            },
          },
        ],
      },
      Translation: {
        type: 'object',
        required: ['source', 'target', 'result', 'original', 'translator'],
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
          result: { type: 'string' },
          original: { type: 'string' },
          confidence: { type: 'number' },
          alternatives: { type: 'array', items: { type: 'string' } },
          key: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          translator: { $ref: '#/components/schemas/Translator' },
        },
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string' },
        },
      },
    },
  },
};
