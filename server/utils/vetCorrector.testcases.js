// Regression test cases for VetCorrector v3
// Run with: node -e "require('./vetCorrector.testcases.js')"

const { correctTranscript } = require('./vetCorrector');

const testCases = [
    {
        name: "Test 1: Should be untouched",
        input: "We will start the patient on gabapentin tonight",
        expected: "We will start the patient on gabapentin tonight"
    },
    {
        name: "Test 2: Should NOT correct common words",
        input: "The dog is walking right next to the owner",
        expected: "The dog is walking right next to the owner"
    },
    {
        name: "Test 3: Should NOT correct common words",
        input: "The owner said the room was cold today",
        expected: "The owner said the room was cold today"
    },
    {
        name: "Test 4: Should NOT correct common words",
        input: "The cat might be limping slightly",
        expected: "The cat might be limping slightly"
    },
    {
        name: "Test 5: Should preserve dosage",
        input: "Give 4 mg per kg of maropitant",
        expected: "Give 4 mg per kg of maropitant"
    },
    {
        name: "Test 6: Should correct drug names",
        input: "Start piroxicam at 0.3 mg/kg",
        expected: "Start piroxicam at 0.3 mg/kg"
    },
    {
        name: "Test 7: Should preserve medical terms",
        input: "He has chronic bronchitis and a soft systolic murmur",
        expected: "He has chronic bronchitis and a soft systolic murmur"
    },
    {
        name: "Test 8: 'right' should NEVER become 'IMHA'",
        input: "The dog walked right past the door",
        expected: "The dog walked right past the door"
    }
];

console.log("=== VetCorrector Regression Tests ===\n");

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
    const result = correctTranscript(test.input);
    const match = result === test.expected;
    
    if (match) {
        console.log(`✅ Test ${index + 1}: ${test.name}`);
        passed++;
    } else {
        console.log(`❌ Test ${index + 1}: ${test.name}`);
        console.log(`   Input:    "${test.input}"`);
        console.log(`   Expected: "${test.expected}"`);
        console.log(`   Got:      "${result}"`);
        failed++;
    }
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

