module.exports = {
  timeSince: function(date) {
    const DATE_FORMATS = [
      { ceiling: 60, text: "$seconds seconds ago" },
      { ceiling: 3600, text: "$minutes minutes ago" },
      { ceiling: 86400, text: "$hours hours ago" },
      { ceiling: 2629744, text: "$days days ago" },
      { ceiling: 31556926, text: "$months months ago" },
      { ceiling: null, text: "$years years ago" }
    ];

    const TIME_UNITS = [
      [31556926, 'years'],
      [2629744, 'months'],
      [86400, 'days'],
      [3600, 'hours'],
      [60, 'minutes'],
      [1, 'seconds']
    ];

    date = new Date(date);
    const REF_DATE = new Date();
    const secondsDifference = Math.abs((REF_DATE - date) / 1000);

    function getFormat() {
      for (var i = 0; i < DATE_FORMATS.length; i++) {
        if (DATE_FORMATS[i].ceiling == null || secondsDifference <= DATE_FORMATS[i].ceiling) {
          return DATE_FORMATS[i];
        }
      }
      return null;
    }

    function getTimeBreakdown() {
      const breakdown = {};
      for (var i = 0; i < TIME_UNITS.length; i++) {
        const occurencesOfUnit = Math.floor(secondsDifference / TIME_UNITS[i][0]);
        breakdown[TIME_UNITS[i][1]] = occurencesOfUnit;
      }
      return breakdown;
    }

    function renderDate(dateFormatted) {
      const breakdown = getTimeBreakdown();
      const timeAgoText = dateFormatted.text.replace(/\$(\w+)/g, function () {
        return breakdown[arguments[1]];
      });
      return depluralizeTimeAgoText(timeAgoText, breakdown);
    }

    function depluralizeTimeAgoText(timeAgoText, breakdown) {
      for (var i in breakdown) {
        if (breakdown[i] == 1) {
          const regexp = new RegExp("\\b" + i + "\\b");
          timeAgoText = timeAgoText.replace(regexp, function () {
            return arguments[0].replace(/s\b/g, '');
          });
        }
      }
      return timeAgoText;
    }

    return renderDate(getFormat());
  }
};