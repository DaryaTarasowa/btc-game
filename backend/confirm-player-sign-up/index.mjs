export const handler = async (event) => ({
  ...event,
  response: {
    ...event.response,
    autoConfirmUser: true,
    autoVerifyEmail: true,
  },
});
