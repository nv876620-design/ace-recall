# Field-Qualified Search

## Overview

Field-qualified search allows you to filter search results using precise field filters, similar to how you might search in GitHub or Google. This feature is inspired by [vibervn-context-engine](https://github.com/nullmastermind/vibervn-context-engine).

## Supported Filters

### `kind:` - Filter by Symbol Kind
Filter by the type of code symbol:

```
kind:function     # Only functions
kind:class        # Only classes
kind:method       # Only methods
kind:interface    # Only interfaces
kind:type         # Only type definitions
kind:const        # Only constants
kind:enum         # Only enums
```

**Examples:**
```
authentication logic kind:function
database models kind:class
API endpoints kind:function kind:method
```

### `lang:` or `language:` - Filter by Programming Language
Filter by the programming language of the file:

```
lang:typescript
lang:python
lang:rust
language:javascript  # 'language:' works too
```

**Examples:**
```
error handling lang:typescript
data models lang:python
http client lang:rust lang:go
```

### `path:` - Filter by File Path
Filter by file path pattern (case-insensitive substring match):

```
path:src/api       # Files in src/api directory
path:components    # Files containing 'components' in path
path:test          # Test files
path:.spec         # Spec files
```

**Examples:**
```
routing logic path:src/api
user authentication path:auth
database connection path:db path:database
```

### `name:` - Filter by Symbol Name
Filter by symbol or function name:

```
name:Handler       # Symbols containing 'Handler'
name:Auth          # Symbols containing 'Auth'
name:validate      # Symbols containing 'validate'
```

**Examples:**
```
request handling name:Handler
authentication flow name:Auth name:login
data validation name:validate name:check
```

## Combining Filters

You can combine multiple filters to narrow down results:

```
kind:function lang:typescript path:src/api name:Handler
error handling kind:function lang:python path:utils
authentication logic kind:class lang:typescript path:auth name:Auth
```

## Query Syntax

### Basic Format
```
[natural language query] [filter:value] [filter:value] ...
```

### Examples

1. **Find authentication functions in TypeScript:**
   ```
   authentication kind:function lang:typescript
   ```

2. **Find all classes in the models directory:**
   ```
   kind:class path:models
   ```

3. **Find error handlers in API routes:**
   ```
   error handling kind:function path:src/api name:Handler
   ```

4. **Find validation logic in Python utils:**
   ```
   validation logic kind:function lang:python path:utils name:validate
   ```

5. **Mixed natural language and filters:**
   ```
   how does user login work kind:function path:auth lang:typescript
   ```

## Usage

### CLI
```bash
coderecall search-context \
  --repo-path . \
  --information-request "authentication kind:function lang:typescript path:src/api"
```

### MCP Tool
```json
{
  "repo_path": "/path/to/repo",
  "information_request": "error handling kind:function lang:python path:utils"
}
```

### Programmatic
```typescript
import { parseQuery, applyFilters, SearchService } from '@coderecall/search';

// Parse query
const parsed = parseQuery("auth logic kind:function lang:typescript");
console.log(parsed);
// {
//   naturalText: "auth logic",
//   filters: {
//     kind: ["function"],
//     lang: ["typescript"]
//   }
// }

// Use in search
const searchService = new SearchService(...);
const results = await searchService.search(parsed);
```

## Implementation Details

### Query Parsing
The `queryParser.ts` module extracts field filters from the query string:

```typescript
parseQuery("auth kind:function lang:ts")
// Returns:
{
  naturalText: "auth",
  filters: {
    kind: ["function"],
    lang: ["ts"]
  }
}
```

### Filter Application
The `filterApplier.ts` module applies filters to search results:

1. **Chunk Enrichment**: Extract metadata from chunks (kind, language, symbol name)
2. **Filter Matching**: Apply each filter with case-insensitive substring matching
3. **Result Filtering**: Return only chunks that pass all filters

### Metadata Extraction
Metadata is extracted from:
- `breadcrumb` field: Extract kind and symbol name
- `language` field: File language
- `file_path`: File path for path filtering

Example breadcrumb parsing:
```
"class UserAuth" → kind: "class", symbolName: "UserAuth"
"function handleLogin" → kind: "function", symbolName: "handleLogin"
"method UserAuth::validate" → symbolName: "validate"
```

## Performance Considerations

1. **Filters applied after initial retrieval**: Filters are applied after the hybrid search (vector + FTS) to avoid over-filtering valuable results
2. **Case-insensitive matching**: All filters use case-insensitive substring matching for better UX
3. **Multiple values per filter**: Each filter can have multiple values (OR logic within a filter)
4. **AND logic across filters**: Different filter types are combined with AND logic

## Future Enhancements

1. **Regex support**: `path:/api\/v[0-9]+/`
2. **Exclusion filters**: `kind:!test` (exclude tests)
3. **Range filters**: `lines:>100` (files with more than 100 lines)
4. **Date filters**: `modified:>2024-01-01`
5. **Author filters**: `author:username` (if git metadata is indexed)

## Examples from Real Codebases

### Express.js API
```
middleware authentication kind:function path:middleware
route handlers kind:function path:routes name:Handler
database models kind:class path:models lang:typescript
```

### React Application
```
component state management kind:function path:components lang:typescript
hooks implementation kind:function path:hooks name:use
context providers kind:function path:context name:Provider
```

### Python Django
```
view functions kind:function path:views lang:python
model definitions kind:class path:models lang:python
serializers kind:class path:serializers name:Serializer
```

## Tips

1. **Start broad, then narrow**: Begin with natural language, add filters if too many results
2. **Combine path + lang**: `path:src/api lang:typescript` is very effective
3. **Use kind for specific symbols**: `kind:function` excludes classes/types/etc.
4. **Multiple values**: `lang:typescript lang:javascript` for multi-language projects
5. **Check breadcrumbs**: Results show breadcrumbs - use `name:` filter based on them
