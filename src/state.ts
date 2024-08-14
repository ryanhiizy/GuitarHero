/** State processing */

type State = Readonly<{
  gameEnd: boolean;
}>;

const initialState: State = {
  gameEnd: false,
} as const;

/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
const tick = (s: State) => s;
