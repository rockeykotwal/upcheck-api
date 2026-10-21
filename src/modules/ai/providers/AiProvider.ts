export interface AiProvider {
  complete(prompt: string): Promise<string>;
}
