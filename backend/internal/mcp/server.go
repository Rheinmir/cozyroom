package mcp

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// jsonRPCRequest is a JSON-RPC 2.0 request.
type jsonRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      any             `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// jsonRPCResponse is a JSON-RPC 2.0 response.
type jsonRPCResponse struct {
	JSONRPC string `json:"jsonrpc"`
	ID      any    `json:"id"`
	Result  any    `json:"result,omitempty"`
	Error   *jsonRPCError `json:"error,omitempty"`
}

type jsonRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// NewHTTPHandler returns an http.HandlerFunc for the /mcp endpoint.
// GET: returns tool list as JSON (for discovery).
// POST: handles JSON-RPC 2.0 tool calls.
func NewHTTPHandler(tools []Tool) http.HandlerFunc {
	byName := make(map[string]*Tool, len(tools))
	for i := range tools {
		byName[tools[i].Name] = &tools[i]
	}

	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		if r.Method == http.MethodGet {
			// Discovery: return tools list
			type toolInfo struct {
				Name        string         `json:"name"`
				Description string         `json:"description"`
				InputSchema map[string]any `json:"inputSchema"`
			}
			list := make([]toolInfo, len(tools))
			for i, t := range tools {
				list[i] = toolInfo{t.Name, t.Description, t.InputSchema}
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{"tools": list})
			return
		}

		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req jsonRPCRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeRPCError(w, nil, -32700, "parse error")
			return
		}

		w.Header().Set("Content-Type", "application/json")

		switch req.Method {
		case "tools/list":
			type toolEntry struct {
				Name        string         `json:"name"`
				Description string         `json:"description"`
				InputSchema map[string]any `json:"inputSchema"`
			}
			entries := make([]toolEntry, len(tools))
			for i, t := range tools {
				entries[i] = toolEntry{t.Name, t.Description, t.InputSchema}
			}
			writeRPCResult(w, req.ID, map[string]any{"tools": entries})

		case "tools/call":
			var params struct {
				Name      string         `json:"name"`
				Arguments map[string]any `json:"arguments"`
			}
			if err := json.Unmarshal(req.Params, &params); err != nil {
				writeRPCError(w, req.ID, -32602, "invalid params")
				return
			}
			tool, ok := byName[params.Name]
			if !ok {
				writeRPCError(w, req.ID, -32601, fmt.Sprintf("tool not found: %s", params.Name))
				return
			}
			result, err := tool.Handler(params.Arguments)
			if err != nil {
				writeRPCError(w, req.ID, -32603, err.Error())
				return
			}
			// MCP content format
			content, _ := json.Marshal(result)
			writeRPCResult(w, req.ID, map[string]any{
				"content": []map[string]any{
					{"type": "text", "text": string(content)},
				},
			})

		default:
			writeRPCError(w, req.ID, -32601, fmt.Sprintf("method not found: %s", req.Method))
		}
	}
}

func writeRPCResult(w http.ResponseWriter, id any, result any) {
	json.NewEncoder(w).Encode(jsonRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Result:  result,
	})
}

func writeRPCError(w http.ResponseWriter, id any, code int, msg string) {
	json.NewEncoder(w).Encode(jsonRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error:   &jsonRPCError{Code: code, Message: msg},
	})
}
