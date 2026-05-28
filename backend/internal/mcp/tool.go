package mcp

// Tool is a single MCP tool definition.
type Tool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
	Handler     func(input map[string]any) (any, error)
}

// AnthropicTool is the shape Claude expects in the API request.
type AnthropicTool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"input_schema"`
}

// ToAnthropic converts a Tool to the Anthropic API format.
func (t Tool) ToAnthropic() AnthropicTool {
	return AnthropicTool{
		Name:        t.Name,
		Description: t.Description,
		InputSchema: t.InputSchema,
	}
}
