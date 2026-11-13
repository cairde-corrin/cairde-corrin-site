// Articles about the group published elsewhere, written in the editor. Each is a card on
// /articles/ that links out; nothing from the source is reproduced beyond one short line.
module.exports = {
  permalink: false,
  eleventyComputed: {
    checked: (data) => {
      if (data.quote && String(data.quote).length > 200) {
        throw new Error(`${data.page.inputPath}: the quoted line is longer than 200 characters. Quote one short line at most.`);
      }
      return true;
    },
  },
};
