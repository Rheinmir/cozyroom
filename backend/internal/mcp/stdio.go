package mcp

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
)

// RunStdio runs the MCP stdio transport, reading JSON-RPC from stdin and writing to stdout.
// Blocks until stdin is closed.
func RunStdio(tools []Tool) {
	byName := make(map[string]*Tool, len(tools))
	for i := range tools {
		byName[tools[i].Name] = &tools[i]
	}

	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var req jsonRPCRequest
		if err := json.Unmarshal(line, &req); err != nil {
			writeStdio(jsonRPCResponse{JSONRPC: "2.0", Error: &jsonRPCError{Code: -32700, Message: "parse error"}})
			continue
		}
		handleStdio(req, tools, byName)
	}
	if err := scanner.Err(); err != nil && err != io.EOF {
		fmt.Fprintf(os.Stderr, "mcp-stdio: read error: %v\n", err)
	}
}

func handleStdio(req jsonRPCRequest, tools []Tool, byName map[string]*Tool) {
	switch req.Method {
	case "initialize":
		writeStdio(jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]any{
				"protocolVersion": "2024-11-05",
				"capabilities":    map[string]any{"tools": map[string]any{}},
				"serverInfo":      map[string]any{"name": "cozyroom", "version": "1.0.0"},
			},
		})
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
		writeStdio(jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result:  map[string]any{"tools": entries},
		})
	case "tools/call":
		var params struct {
			Name      string         `json:"name"`
			Arguments map[string]any `json:"arguments"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			writeStdio(jsonRPCResponse{JSONRPC: "2.0", ID: req.ID, Error: &jsonRPCError{Code: -32602, Message: "invalid params"}})
			return
		}
		tool, ok := byName[params.Name]
		if !ok {
			writeStdio(jsonRPCResponse{JSONRPC: "2.0", ID: req.ID, Error: &jsonRPCError{Code: -32601, Message: fmt.Sprintf("tool not found: %s", params.Name)}})
			return
		}
		result, err := tool.Handler(params.Arguments)
		if err != nil {
			writeStdio(jsonRPCResponse{JSONRPC: "2.0", ID: req.ID, Error: &jsonRPCError{Code: -32603, Message: err.Error()}})
			return
		}
		content, _ := json.Marshal(result)
		writeStdio(jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]any{
				"content": []map[string]any{
					{"type": "text", "text": string(content)},
				},
			},
		})
	default:
		writeStdio(jsonRPCResponse{JSONRPC: "2.0", ID: req.ID, Error: &jsonRPCError{Code: -32601, Message: fmt.Sprintf("method not found: %s", req.Method)}})
	}
}

func writeStdio(resp jsonRPCResponse) {
	b, _ := json.Marshal(resp)
	fmt.Fprintf(os.Stdout, "%s\n", b)
}
