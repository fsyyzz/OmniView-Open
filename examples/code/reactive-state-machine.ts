/**
 * OmniView 响应式状态机分发中枢
 */

export type StateListener<TState extends string, TContext> = (
  state: TState,
  context: TContext,
  event: string
) => void;

export interface TransitionRule<TState extends string, TEvent extends string, TContext> {
  from: TState;
  to: TState;
  event: TEvent;
  guard?: (context: TContext) => boolean;
  action?: (context: TContext) => Promise<void> | void;
}

export class FiniteStateMachine<TState extends string, TEvent extends string, TContext extends Record<string, unknown>> {
  private currentState: TState;
  private readonly listeners: Set<StateListener<TState, TContext>> = new Set();
  private readonly transitions: Map<string, TransitionRule<TState, TEvent, TContext>> = new Map();

  constructor(
    initialState: TState,
    private context: TContext
  ) {
    this.currentState = initialState;
  }

  public registerTransition(rule: TransitionRule<TState, TEvent, TContext>): this {
    const key = `${rule.from}->${rule.event}`;
    this.transitions.set(key, rule);
    return this;
  }

  public getState(): TState {
    return this.currentState;
  }

  public getContext(): Readonly<TContext> {
    return Object.freeze({ ...this.context });
  }

  public subscribe(listener: StateListener<TState, TContext>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async dispatch(event: TEvent, payload?: Partial<TContext>): Promise<boolean> {
    const key = `${this.currentState}->${event}`;
    const rule = this.transitions.get(key);

    if (!rule) {
      console.warn(`[FSM] 无效状态转移: 当前状态 [${this.currentState}] 无法响应事件 [${event}]`);
      return false;
    }

    if (payload) {
      this.context = { ...this.context, ...payload };
    }

    if (rule.guard && !rule.guard(this.context)) {
      console.warn(`[FSM] 状态转移被守卫拦截: ${key}`);
      return false;
    }

    const previousState = this.currentState;
    this.currentState = rule.to;

    if (rule.action) {
      await rule.action(this.context);
    }

    for (const listener of this.listeners) {
      listener(this.currentState, this.context, event);
    }

    return true;
  }
}
