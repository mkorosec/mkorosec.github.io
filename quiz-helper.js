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
    keyboard: false
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

//select the current quiz
function startQuiz(quiz) {
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
}

function changeCategoryModal() {
    categoriesModal.show();
}

function changeCategory() {
    const categorySelect = document.getElementById('categorySelect');
    const categorySelectedValue = categorySelect.value;
    var found = false;
    quizOptions.forEach((option) => {
        if (option.name === categorySelectedValue) {
            currentQuiz = option;
            found = true;
            startQuiz(option);
        }
    });
    if (!found) {
        console.error('Unknown category:', categorySelectedValue);
    }
    categoriesModal.hide();
}


function evaluateResult(kmOffset) {
    if (kmOffset < 10) {
        return {points: (100-kmOffset), label: 'bullseye!'};
    } else if (kmOffset < 50) {
        return {points: (100-kmOffset), label: 'nice - very close!'};
    } else if (kmOffset < 100) {
        return {points: 50, label: 'nice - close!'};
    } else if (kmOffset < 500) {
        return {points: 25, label: 'not bad - but there\'s room for improvement!'};
    } else if (kmOffset < 1000) {
        return {points: 5, label: 'better aim next time!'};
    } else {
        return {points: 0, label: 'far off the mark!'};
    }
}
