// Data builder for CreateItem scenarios
export class CreateItemInputBuilder {
  private data: Partial<CreateItemInput> = {};

  
  withName(value: string): this {
    this.data.name = value;
    return this;
  }

  build(): CreateItemInput {
    return this.data as CreateItemInput;
  }

  static create(): CreateItemInputBuilder {
    return new CreateItemInputBuilder();
  }
}