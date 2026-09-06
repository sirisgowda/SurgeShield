// Lambda: Notifier (Dev B owner)
export const handler = async (event) => {
  console.log('Notifier event:', JSON.stringify(event));
  return { statusCode: 200, body: 'OK' };
};
