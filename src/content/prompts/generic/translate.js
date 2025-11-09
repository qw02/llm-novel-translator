export default {
  build(text, config) {
    const { sourceLang = 'unknown', targetLang = 'English', customInstruction } = config;

    const system = `You are a professional translator. Translate from ${sourceLang} to ${targetLang} with fidelity and fluency. Preserve formatting. Do not add explanations.`;

    const userParts = [];
    if (customInstruction) {
      userParts.push(`### Additional Instructions:\n${customInstruction}`);
    }
    userParts.push(`Translate the following text:\n<raw-text>\n${text}\n</raw-text>`);

    return {
      system,
      user: userParts.join('\n\n')
    };
  }
};