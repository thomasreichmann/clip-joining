function recusive(val) {
  console.log(val);
  if (val === 0) {
    return 0;
  }
  return recusive(val - 1);
}

recusive(10);
