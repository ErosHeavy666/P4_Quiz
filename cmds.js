const Sequelize = require('sequelize');

const {
  models
} = require('./model');

const {
  log,
  biglog,
  errorlog,
  colorize
} = require("./out");


/**
 * Muestra la ayuda
 *
 * @param rl Objeto readline usado para implementar el CLI.
 */

 exports.helpCmd = (socket, rl) => {
  log(socket, " Commandos:");
  log(socket, " h|help - Muestra esta ayuda.");
  log(socket, " list -Listar los quizzes existentes.");
  log(socket, " show <id> - Muestra la pregunta y la respuesta el quiz indicado.");
  log(socket, " add - Añadir un nuevo quiz interactivamente.");
  log(socket, "delete <id> - Borrar el quiz indicado.");
  log(socket, "edit <id> -Editar el quiz indicado.");
  log(socket, "test <id> -Probar el quiz indicado.");
  log(socket, " p|play - Jugar a preguntar aleatoriamente todos los quizzes.");
  log(socket, " credits - Créditos.");
  log(socket, " q|quit _ Salir del programa.");
  rl.prompt();
};

/**
 * Terminar el programa
 */
 exports.quitCmd = (socket, rl) => {
  rl.close();
  socket.end();
    //rl.prompt();
  };

  const makeQuestion = (rl, text) => {
    return new Sequelize.Promise((resolve, reject) => {
      rl.question(colorize(text, 'red'), answer => {
        resolve(answer.trim());
      });
    });
  };

/**
 * Añade un nuevo quiz al módelo
 * Pregunta interactivamente por la pregunta y por la resuesta
 * @param rl  Objeto readline usado para implementar el CLI
 */
 exports.addCmd = (socket, rl) => {
  makeQuestion(rl, ' Introduzca una pregunta: ')
  .then(q => {
    return makeQuestion(rl, ' Introduzca la respuesta ')
    .then(a => {
      return {
        question: q,
        answer: a
      };
    });
  })
  .then(quiz => {
    return models.quiz.create(quiz);
  })
  .then((quiz) => {
    log(socket, ` ${colorize('Se ha añadido', 'magenta')}: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
  })
  .catch(Sequelize.ValidationError, error => {
    errorlog(socket, 'El quiz es erroneo:');
    error.errors.forEach(({
      message
    }) => errorlog(socket, message));
  })
  .catch(error => {
    errorlog(socket, error.message);
  })
  .then(() => {
    rl.prompt();
  });
};

/**
 * Lista todos los quizzes existentes en el modelo
 */

 exports.listCmd =(socket, rl) => {
  models.quiz.findAll()
  .each(quiz => {
    log(socket, `[${colorize(quiz.id, 'magenta')}]: ${quiz.question}`);
  })
  .catch(error => {
    errorlog(socket, error.message);
  })
  .then(() => {
    rl.prompt();
  });
};


const validateId = (socket, id) => {

  return new Sequelize.Promise((resolve, reject) => {
    if (typeof id === "undefined") {
      reject(new Error(`Falta el parametro <id>.`));
    } else {
            id = parseInt(id); //coger la parte entera y descartar lo demas
            if (Number.isNaN(id)) {
              reject(new Error(`El valor del parámetro <id> no es un número.`));
            } else {
              resolve(id);
            }
          }
        });
};
/**
 * Muestra el quiz indicado en el parámetro: la pregunta y la respuesta.
 *
 * @param id Clave del quiz a mostrar.
 * @param rl Clve del quiz a mostrar
 */

 exports.showCmd = (socket, rl, id) => {
  validateId(id)
  .then(id => models.quiz.findById(id))
  .then(quiz => {
    if (!quiz) {
      throw new Error(`No existe un quiz asociado al id=${id}.`);
    }
    log(socket,` [${colorize(quiz.id, 'magenta')}]: ${quiz.question} ${colorize('=>','magenta')} ${quiz.answer}`);

  })
  .catch(error => {
    errorlog(socket, error.message);
  })
  .then(() => {
    rl.prompt();
  })
};

/**
 * Prueba un quiz, es decir, hace una pregunta del modelo a la que debemos contestar.
 *
 * @param id Clave del quiz a probar.
 * @param rl Objeto readline usado para implementar el CLI
 */

 exports.testCmd = (socket, rl, id) => {
  validateId(id)
  .then(id => models.quiz.findById(id))
  .then(quiz => {
    if (!quiz) {
      throw new Error(`No existe un quiz asociado al id=${id}.`);
    }
    return makeQuestion(rl, `${quiz.question}`)
    .then(answer => {
      if (answer.toLowerCase() === quiz.answer.toLowerCase().trim()) {
        log(socket,` ${colorize('Correcto', 'magenta')}`);
        biglog(socket,'Correcto', 'green');
      } else {
        log(socket,` ${colorize('Incorrecto', 'magenta')}`);
        biglog(socket,'Incorrecto', 'red');
      }
                    //rl.prompt();
                  });
  })
  .catch(error => {
    errorlog(socket, error.message);

  })
  .then(() => {
    rl.prompt();
  });
};

/**
 * Pregunta todos los quizzes existentes en el modelo en orden aleatorio
 * Se gana si se contesta a todos satisfactoriamente.
 */


 exports.playCmd = (socket, rl) => {
  let score = 0;
  let toBeResolved = [];


  const playOne = () => {
    return new Promise((resolve, reject) => {
      if (toBeResolved.length <= 0) {
        log(socket, 'No hay nada más que preguntar');
        resolve();
        return;
      }

      let id = Math.floor((Math.random() * toBeResolved.length));
      let quiz = toBeResolved[id];
      toBeResolved.splice(id, 1);

      return makeQuestion(rl, `${quiz.question}`)
      .then(answer => {
        if (answer.toLowerCase() === quiz.answer.toLowerCase().trim()) {
          score++;
          log(socket, ` ${colorize('Correcto', 'magenta')}`);
          resolve(playOne());
        } else {
          log(socket, ` ${colorize('Incorrecto', 'magenta')}`);
          resolve();
        }
      });
    });
  };

  models.quiz.findAll({raw: true})
  .then(quizzes => {
   toBeResolved = quizzes;
 })
  .then(() => {
    return playOne();
  })
  .catch(error => {
    errorlog(socket, error.message);
  })
  .then(() => {
    fin();
    rl.prompt();
  });

  const fin = () => {
    log(socket, `Fin del examen. Aciertos:`);
    biglog(socket, score, 'magenta');
  };

};




/**
 * Borra un quiz del modelo.
 *
 * @param id clave del quiz a borrar en el modelo
 * @param rl Objeto readline usado para implementar el CLI
 */

 exports.deleteCmd = (socket, rl, id) => {

  validateId(id)
  .then(id => models.quiz.destroy({
    where: {
      id
    }
  }))
  .catch(error => {
    errorlog(socket,error.message);
  })
  .then(() => {
    rl.prompt();
  });
    //rl.prompt();
  };

/**
 * Edita un quiz del modelo.
 *
 * @param id Clave del quiz a editar en el modelo.
 * @param rl Objeto readline usado para implementar el CLI
 */

 exports.editCmd = (socket, rl, id) => {
  validateId(id)
  .then(id => model.quiz.findById(id))
  .then(quiz => {
    if (!quiz) {
      throw new Error(socket, `No existe un quiz asociado al id=${id}.`);
    }

    process.stdout.isTTY && setTimeout(() => {
      rl.write(quiz.question)
    }, 0);
    return makeQuestion(rl, 'Introduzca la pregunta: ')
    .then(q => {
      process.stdout.isTTY && setTimeout(() => {
        rl.write(quiz.question)
      }, 0);
      return makeQuestion(rl, 'Introduzca la respuesta: ')
      .then(a => {
        quiz.question = q;
        quiz.answer = a;
        return quiz;
      });
    });
  })
  .then(quiz => {
    return quiz.save();
  })
  .then(quiz => {
    log(socket, ` Se ha cambiado el quiz ${colorize(quiz.id, 'magenta')} por: ${quiz.question} ${colorize('=>','magenta')} ${quiz.answer}`);
  })
  .catch(Sequelize.ValidationError, error => {
    errorlog(socket, 'El quiz es erroneo:');
    error.errors.forEach(({
      message
    }) => errorlog(socket, message));
  })
  .catch(error => {
    errorlog(socket, error.message);
  })
  .then(() => {
    rl.prompt();
  });
};

/**
 * Muestra los nombres de los autores de la práctica.
 */
 exports.creditsCmd = function(socket, rl) {
  log(socket, 'Autores de la práctica');
  log(socket, 'Eros García Arroyo', 'green');
  log(socket, 'Luis García Olivares', 'green');
  rl.prompt();
};