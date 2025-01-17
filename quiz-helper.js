var latestGuess = null;
var question = null;
var answer = null;
var allowNewMarkerPlacement = true;
var totalPoints = 0;
var answered = 0;
var currentQuiz = null;

const resultsModal = new bootstrap.Modal(document.getElementById('resultsModal'), {
    backdrop: 'static',
    keyboard: false
});
const categoriesModal = new bootstrap.Modal(document.getElementById('categoriesModal'), {
});

function animateMarker(marker) {
    const myIcon = marker._icon;
    const myShadow = marker._shadow;
    myIcon.style.transition = 'all 0s';
    myShadow.style.transition = 'all 0s';
    const transformOriginal = myIcon.style.transform;
    const transformOriginalShadow = myIcon.style.transform;

    myIcon.style.transform = transformOriginal + ' translateY(-1000px)';
    myShadow.style.transform = transformOriginalShadow + ' translateY(-1000px)';
    setTimeout(function(){
        myIcon.style.transition = 'all 0.4s';
        myShadow.style.transition = 'all 0.4s';
        myIcon.style.transform = transformOriginal;
        myShadow.style.transform = transformOriginalShadow;
    }, 100)
    setTimeout(function(){
        myIcon.style.transition = '';
        myShadow.style.transition = '';
    }, 500)
}

function displayResults(totalPoints, quiz) {
    //show results
    if (quiz.id === 'daily') {
        document.getElementById('dailyResultsMessage').style.display = 'block';
    } else {
        document.getElementById('dailyResultsMessage').style.display = 'none';
    }
    document.getElementById('pointsInDialog').innerText = `Results: ${quiz.name}`;
    document.getElementById('pointsInDialog').innerText = totalPoints;
    document.getElementById('possiblePoints').innerText = quiz.questions.length * 100;
    document.getElementById('pointsPct').innerText = Math.round(totalPoints / (quiz.questions.length * 100) * 100) + '%';

    const answersList = document.querySelector('#resultsModal .answers');
    answersList.innerHTML = '';
    quiz.results.forEach((result) => {
        const li = document.createElement('li');
        //li.innerHTML = `<strong>${result.question}</strong><br>Answer: ${result.answer.label}<br>Your guess: ${result.guess.lat.toFixed(3)}, ${result.guess.lng.toFixed(3)}<br>Distance: ${(result.distance/1000).toFixed(2)}km`;

        li.innerHTML = getResultEmoji(result.points) + `<strong>${result.answer.label}</strong> - ${(result.distance/1000).toFixed(2)}km off target`;
        answersList.appendChild(li);
    });
    
    document.getElementById('copyBtn').innerText = 'Share results (without spoilers)';
    resultsModal.show();
}

function getResultEmoji(points) {
    if (points > 90) {
        return '🎯';
    } else if (points > 75) {
        return '👍';
    } else if (points > 50) {
        return '😶';
    } else {
        return '👎';
    }
}

function copyResultToClipboard() {
    const pointsPct = Math.round(totalPoints / (currentQuiz.questions.length * 100) * 100) + '%';
    const availablePoints = currentQuiz.questions.length * 100;
    const link = `https://mkorosec.github.io/#${currentQuiz.id}`;
    //get list of emojis for each result
    var emojiText = '';
    currentQuiz.results.forEach((result) => {
        emojiText += getResultEmoji(result.points);
    });
    const text = `"${currentQuiz.name}" quiz results: Accuracy ${pointsPct}, got ${totalPoints}/${availablePoints} points. Try it yourself at ${link}\n${emojiText}`;

    navigator.clipboard.writeText(text).then(() => {
        document.getElementById('copyBtn').innerText = 'Copied to clipboard!';
    });
}

String.prototype.hashCode = function() {
  var hash = 0,
    i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

function getLastPlayedDailyHashCode() {
    return localStorage.getItem('lastPlayedDailyHashCode');
}

function setLastPlayedDailyHashCode(questions) {
    const questionsHash = JSON.stringify(questions).hashCode();
    localStorage.setItem('lastPlayedDailyHashCode', questionsHash);
}

//select the current quiz
function startQuiz(quiz) {
    if (quiz.id === 'daily') {
        //ensure only once per day
        //ensure that by generating a hash for the questions and storing it in localStorage
        const questionsHash = JSON.stringify(quiz.questions).hashCode().toString();
        const lastPlayedDailyHashCode = localStorage.getItem('lastPlayedDailyHashCode');
        if (lastPlayedDailyHashCode === questionsHash) {
            //get items back from localStorage
            const dailyQuizResults = JSON.parse(localStorage.getItem('dailyQuizResults'));
            const dailyQuizTotalPoints = localStorage.getItem('dailyQuizTotalPoints');
            const quiz = window.quizList.find((quiz) => quiz.id === 'daily');
            quiz.results = dailyQuizResults;
            totalPoints = dailyQuizTotalPoints;
            currentQuiz = quiz;
            displayResults(dailyQuizTotalPoints, quiz);
            //categoriesModal.show();
            //alert('Already played today - try the daily quiz again tomorrow! Until then - choose a different quiz!');
            return;
        }
    }
    if (quiz.id === 'random') {
        //combine all questions from all quizzes and pick 10 at random
        const allQuestions = [];
        window.quizList.forEach((quiz) => {
            quiz.questions.forEach((question) => {
                allQuestions.push(question);
            });
        });
        quiz.questions = [];
        for (let i = 0; i < 10; i++) {
            const randomIndex = Math.floor(Math.random() * allQuestions.length);
            quiz.questions.push(allQuestions[randomIndex]);
            allQuestions.splice(randomIndex, 1);
        }
    }
    currentQuiz = quiz;
    currentQuiz.questionsIndex = 0;
    currentQuiz.results = [];
    totalPoints = 0;
    answered = 0;
    categorySelect.value = quiz.name;
    document.getElementById('quizName').innerText = quiz.name;
    document.getElementById('allAnswers').innerText = quiz.questions.length;
    document.getElementById('allPoints').innerText = quiz.questions.length * 100;
    document.getElementById('answers').innerText = '0';
    document.getElementById('points').innerText = '0';
    nextQuestion();
    categoriesModal.hide();
    resultsModal.hide();

    if (quiz.order === 'strict') {

    } else {
        quiz.questions = shuffle(quiz.questions);
    }

    if (currentQuiz.map !== undefined) {
        if (currentQuiz.map.lat !== undefined && currentQuiz.map.lng !== undefined) {
            setTimeout(() => {
                map.setView([currentQuiz.map.lat, currentQuiz.map.lng]);
            }, 100);
        } else {
            map.setView([20, 0], 2);
        }
        if (currentQuiz.map.zoom !== undefined) {
            map.setZoom(currentQuiz.map.zoom);
        } else {
            map.setZoom(2);
        }
    } else {
        map.setView([20, 0], 2);
    }
}

function changeCategoryModal() {
    categoriesModal.show();
    resultsModal.hide();
}

function changeCategory(random) {
    if (random) {
        const currentQuizId = currentQuiz != null ? currentQuiz.id : null;
        var randomQuiz;
        do {
            randomQuiz = window.quizList[Math.floor(Math.random() * window.quizList.length)];
        } while (randomQuiz.id === currentQuizId);
        startQuiz(randomQuiz);
    } else {
        const categorySelect = document.getElementById('categorySelect');
        const categorySelectedValue = categorySelect.value;
        var found = false;
        window.quizList.forEach((option) => {
            if (option.name === categorySelectedValue) {
                currentQuiz = option;
                found = true;
                startQuiz(option);
            }
        });
        if (!found) {
            console.error('Unknown category:', categorySelectedValue);
        }
    }
    categoriesModal.hide();
}

function evaluateResult(kmOffset) {
    const maxPoints = 100;
    var scale = 500; //TODO - configure per quiz
    if (currentQuiz.scale !== undefined) {
        scale = currentQuiz.scale;
    }

    const points = Math.round(maxPoints * Math.exp(-kmOffset / scale));
    let label;
    
    if (points > 95) {
        label = 'bullseye!';
    } else if (points > 90) {
        label = 'nice - very close!';
    } else if (points > 80) {
        label = 'nice - close!';
    } else if (points > 70) {
        label = 'not bad - but there\'s room for improvement!';
    } else if (points > 60) {
        label = 'better aim next time!';
    } else if (points > 20) {
        label = 'you can do better!';
    } else {
        label = 'far off the mark!';
    }

    return { points, label };
}